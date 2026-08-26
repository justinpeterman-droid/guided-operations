import "server-only";

import { createHmac } from "node:crypto";

import {
  evaluateAuthRateLimit,
  type AuthRateLimitPolicy,
  type RateLimitDecision,
} from "@/features/auth/rate-limit";
import {
  GENERIC_SIGN_IN_FAILURE,
  normalizeEmployeeNumber,
} from "@/features/auth/credentials";

import {
  signInWithEmployeeNumber,
  type EmployeeSignInDependencies,
  type EmployeeSignInResult,
} from "./employee-sign-in";

export type AuthAttemptSubjectKind =
  "account" | "device" | "network" | "global";

export type AuthAttemptOutcome = "allowed" | "denied" | "failed";

export type AuthAttemptSubject = Readonly<{
  kind: AuthAttemptSubjectKind;
  digest: string;
}>;

export type AuthAttemptStore = {
  listOccurredAt(
    subject: AuthAttemptSubject,
    since: Date,
  ): Promise<readonly number[]>;
  record(
    subjects: readonly AuthAttemptSubject[],
    outcome: AuthAttemptOutcome,
    expiresAt: Date,
  ): Promise<void>;
};

export type GuardedSignInDependencies = Readonly<{
  employeeSignIn: EmployeeSignInDependencies;
  attemptStore: AuthAttemptStore;
  policy: AuthRateLimitPolicy;
}>;

export type GuardedSignInRequest = Readonly<{
  employeeNumber: string;
  passcode: string;
  /** Already keyed server-side; do not pass raw device identifiers here. */
  deviceDigest: string;
  /** Already keyed server-side; do not pass raw network identifiers here. */
  networkDigest: string;
  /** A stable opaque server-wide value, keyed before this service is called. */
  globalDigest: string;
}>;

const SUBJECT_DIGEST = /^[a-f0-9]{64}$/;

function assertSubjectDigest(digest: string): void {
  if (!SUBJECT_DIGEST.test(digest)) {
    throw new Error(
      "Auth attempt subject digest must be a SHA-256 hex digest.",
    );
  }
}

function longestWindow(policy: AuthRateLimitPolicy): number {
  return Math.max(
    policy.account.windowMs,
    policy.device.windowMs,
    policy.network.windowMs,
    policy.global.windowMs,
  );
}

/**
 * Produces purpose-separated opaque identifiers for rate-limit storage. The
 * caller retains the original employee/device/network value only in request
 * memory and never records it in the database or audit logs.
 */
export function createAuthAttemptSubjectDigest(
  kind: AuthAttemptSubjectKind,
  value: string,
  hmacKey: string,
): string {
  if (!value || !hmacKey) {
    throw new Error(
      "Auth attempt subject values require a value and HMAC key.",
    );
  }

  return createHmac("sha256", hmacKey)
    .update("guided-operations/auth-attempt/v1\u0000", "utf8")
    .update(kind, "utf8")
    .update("\u0000", "utf8")
    .update(value, "utf8")
    .digest("hex");
}

function deniedResult(decision: RateLimitDecision): EmployeeSignInResult {
  if (decision.allowed) {
    throw new Error("A rate-limit denial requires a denied decision.");
  }

  return { status: "failed", message: GENERIC_SIGN_IN_FAILURE };
}

/**
 * Executes layered abuse controls before the private account lookup and
 * records only opaque digests. The caller must map every failure to the same
 * public response, including a rate-limit denial.
 */
export async function signInWithEmployeeNumberGuarded(
  request: GuardedSignInRequest,
  dependencies: GuardedSignInDependencies,
  now = new Date(),
): Promise<EmployeeSignInResult> {
  const accountDigest = createAuthAttemptSubjectDigest(
    "account",
    normalizeEmployeeNumber(request.employeeNumber),
    dependencies.employeeSignIn.employeeLookupHmacKey,
  );
  const subjects = [
    { kind: "account", digest: accountDigest },
    { kind: "device", digest: request.deviceDigest },
    { kind: "network", digest: request.networkDigest },
    { kind: "global", digest: request.globalDigest },
  ] as const;
  subjects.forEach((subject) => assertSubjectDigest(subject.digest));

  const since = new Date(now.getTime() - longestWindow(dependencies.policy));
  const [accountAttempts, deviceAttempts, networkAttempts, globalAttempts] =
    await Promise.all(
      subjects.map((subject) =>
        dependencies.attemptStore.listOccurredAt(subject, since),
      ),
    );
  const decision = evaluateAuthRateLimit(
    { accountAttempts, deviceAttempts, networkAttempts, globalAttempts },
    dependencies.policy,
    now.getTime(),
  );
  const expiresAt = new Date(
    now.getTime() + longestWindow(dependencies.policy),
  );

  if (!decision.allowed) {
    await dependencies.attemptStore.record(subjects, "denied", expiresAt);
    return deniedResult(decision);
  }

  const result = await signInWithEmployeeNumber(
    request.employeeNumber,
    request.passcode,
    dependencies.employeeSignIn,
  );
  await dependencies.attemptStore.record(
    subjects,
    result.status === "signed_in" ? "allowed" : "failed",
    expiresAt,
  );
  return result;
}
