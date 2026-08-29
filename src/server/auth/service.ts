import { timingSafeEqual } from "node:crypto";

import { deriveCsrfToken } from "./csrf";
import { employeeLookupDigest, normalizeEmployeeNumber } from "./employee-number";
import { verifyPasscode } from "./passcode";
import { hashAuthSubject } from "./subjects";
import {
  hashOpaqueSecret,
  issueOpaqueSecret,
  issueOpaqueToken,
  parseOpaqueToken,
} from "./tokens";
import type { AuthRepository, CurrentAccount } from "./types";

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const SESSION_IDLE_MS = 60 * MINUTE;
const SESSION_ABSOLUTE_MS = 12 * HOUR;
const SESSION_ROTATE_MS = 30 * MINUTE;
const LOCK_AFTER_FAILURES = 5;
const LOCK_SECONDS = 15 * 60;

const DUMMY_PASSCODE_HASH =
  "scrypt$v=1$N=32768$r=8$p=3$AAECAwQFBgcICQoLDA0ODw$Ht1_wgvDK-JFLpA_0dUmT4Yy4u90hkC10yvXsKnOwwI";

const RATE_LIMITS = [
  { subject: "account" as const, limit: 5, windowSeconds: 900, blockSeconds: 900 },
  { subject: "device" as const, limit: 20, windowSeconds: 900, blockSeconds: 900 },
  { subject: "network" as const, limit: 50, windowSeconds: 900, blockSeconds: 900 },
  { subject: "global" as const, limit: 1000, windowSeconds: 60, blockSeconds: 60 },
];

export interface AuthServiceSecrets {
  employeeLookupPepper: string;
  sessionHmacKey: string;
  deviceHmacKey: string;
  networkHmacKey: string;
  csrfHmacKey: string;
}

export interface AuthServiceDependencies {
  repository: AuthRepository;
  secrets: AuthServiceSecrets;
  now?: () => Date;
}

export type SignInResult =
  | {
      success: true;
      sessionToken: string;
      csrfToken: string;
      account: CurrentAccount;
    }
  | {
      success: false;
      code: "invalid-credentials";
    }
  | {
      success: false;
      code: "rate-limited";
      retryAfterSeconds: number;
    };

export interface ResolvedSession {
  account: CurrentAccount;
  sessionId: string;
  sessionSecret: string;
  csrfToken: string;
  replacementSessionToken: string | null;
}

export interface AuthService {
  signIn(input: {
    employeeNumber: string;
    passcode: string;
    deviceId: string;
    networkId: string;
  }): Promise<SignInResult>;
  resolveSession(serializedSession: string): Promise<ResolvedSession | null>;
  signOut(serializedSession: string): Promise<void>;
}

export function createAuthService({
  repository,
  secrets,
  now = () => new Date(),
}: AuthServiceDependencies): AuthService {
  return {
    async signIn(input) {
      const timestamp = now();
      const candidate = prepareEmployeeCandidate(
        input.employeeNumber,
        secrets.employeeLookupPepper,
      );
      const deviceHash = hashAuthSubject(
        "device",
        input.deviceId || "missing-device",
        secrets.deviceHmacKey,
      );
      const networkHash = hashAuthSubject(
        "network",
        input.networkId || "missing-network",
        secrets.networkHmacKey,
      );
      const globalHash = hashAuthSubject(
        "global",
        "guided-operations-login",
        secrets.networkHmacKey,
      );

      const rateSubjects = {
        account: candidate.lookupHash,
        device: deviceHash,
        network: networkHash,
        global: globalHash,
      };
      const rateResults = await Promise.all(
        RATE_LIMITS.map((rule) =>
          repository.applyRateLimit(
            rule.subject,
            rateSubjects[rule.subject],
            rule.limit,
            rule.windowSeconds,
            rule.blockSeconds,
          ),
        ),
      );
      const blocked = rateResults.filter((result) => !result.allowed);
      if (blocked.length > 0) {
        return {
          success: false,
          code: "rate-limited",
          retryAfterSeconds: Math.max(
            1,
            ...blocked.map((result) => result.retryAfterSeconds),
          ),
        };
      }

      const account = await repository.lookupAccount(candidate.lookupHash);
      const eligible = accountCanAttemptLogin(account, timestamp);
      const hashToVerify = eligible ? account!.passcodeHash : DUMMY_PASSCODE_HASH;
      const verified = await verifyPasscode(hashToVerify, input.passcode);

      if (!eligible || !verified) {
        if (eligible && account) {
          await repository.recordLoginFailure(
            account.accountId,
            LOCK_AFTER_FAILURES,
            LOCK_SECONDS,
          );
        }

        return { success: false, code: "invalid-credentials" };
      }

      const issued = issueOpaqueToken();
      const secretHash = hashOpaqueSecret(issued.secret, secrets.sessionHmacKey);
      const idleExpiresAt = new Date(timestamp.getTime() + SESSION_IDLE_MS);
      const absoluteExpiresAt = new Date(
        timestamp.getTime() + SESSION_ABSOLUTE_MS,
      );
      const created = await repository.createSession({
        sessionId: issued.id,
        accountId: account.accountId,
        expectedAuthVersion: account.authVersion,
        secretHash,
        deviceHash,
        networkHash,
        idleExpiresAt,
        absoluteExpiresAt,
      });

      if (!created) {
        return { success: false, code: "invalid-credentials" };
      }

      const currentAccount = await repository.loadCurrentAccount(account.accountId);
      if (!currentAccount) {
        await repository.revokeSession(
          issued.id,
          secretHash,
          "account-unavailable",
        );
        return { success: false, code: "invalid-credentials" };
      }

      return {
        success: true,
        sessionToken: issued.serialized,
        csrfToken: deriveCsrfToken(
          issued.id,
          issued.secret,
          secrets.csrfHmacKey,
        ),
        account: currentAccount,
      };
    },

    async resolveSession(serializedSession) {
      const parsed = parseOpaqueToken(serializedSession);
      if (!parsed) {
        return null;
      }

      const timestamp = now();
      const presentedHash = hashOpaqueSecret(
        parsed.secret,
        secrets.sessionHmacKey,
      );
      const stored = await repository.resolveSession(parsed.id);
      if (!stored) {
        return null;
      }

      const matchesCurrent = safeHexEqual(presentedHash, stored.secretHash);
      const matchesPrevious =
        stored.previousSecretHash !== null &&
        stored.previousValidUntil !== null &&
        stored.previousValidUntil.getTime() > timestamp.getTime() &&
        safeHexEqual(presentedHash, stored.previousSecretHash);

      if (
        (!matchesCurrent && !matchesPrevious) ||
        stored.revokedAt !== null ||
        stored.status !== "active" ||
        stored.sessionAuthVersion !== stored.accountAuthVersion ||
        stored.idleExpiresAt.getTime() <= timestamp.getTime() ||
        stored.absoluteExpiresAt.getTime() <= timestamp.getTime()
      ) {
        return null;
      }

      const idleExpiresAt = new Date(
        Math.min(
          timestamp.getTime() + SESSION_IDLE_MS,
          stored.absoluteExpiresAt.getTime(),
        ),
      );
      if (idleExpiresAt.getTime() <= timestamp.getTime()) {
        return null;
      }

      const rotationDue =
        matchesCurrent &&
        stored.rotatedAt.getTime() <= timestamp.getTime() - SESSION_ROTATE_MS;
      const nextSecret = rotationDue ? issueOpaqueSecret() : null;
      const nextSecretHash = nextSecret
        ? hashOpaqueSecret(nextSecret, secrets.sessionHmacKey)
        : null;
      const refreshed = await repository.refreshSession({
        sessionId: parsed.id,
        presentedHash,
        newSecretHash: nextSecretHash,
        newIdleExpiresAt: idleExpiresAt,
      });
      if (!refreshed.accepted) {
        return null;
      }

      const account = await repository.loadCurrentAccount(stored.accountId);
      if (
        !account ||
        account.status !== "active" ||
        account.authVersion !== stored.accountAuthVersion
      ) {
        return null;
      }

      const effectiveSecret = refreshed.rotated && nextSecret
        ? nextSecret
        : parsed.secret;
      const replacementSessionToken = refreshed.rotated && nextSecret
        ? `${parsed.id}.${nextSecret}`
        : null;

      return {
        account,
        sessionId: parsed.id,
        sessionSecret: effectiveSecret,
        csrfToken: deriveCsrfToken(
          parsed.id,
          effectiveSecret,
          secrets.csrfHmacKey,
        ),
        replacementSessionToken,
      };
    },

    async signOut(serializedSession) {
      const parsed = parseOpaqueToken(serializedSession);
      if (!parsed) {
        return;
      }

      await repository.revokeSession(
        parsed.id,
        hashOpaqueSecret(parsed.secret, secrets.sessionHmacKey),
        "user-logout",
      );
    },
  };
}

function prepareEmployeeCandidate(
  rawEmployeeNumber: string,
  pepper: string,
): { lookupHash: string; normalized: string | null } {
  const bounded = rawEmployeeNumber.slice(0, 128);

  try {
    const normalized = normalizeEmployeeNumber(bounded);
    return {
      normalized,
      lookupHash: employeeLookupDigest(normalized, pepper),
    };
  } catch {
    const canonicalInvalid = bounded.normalize("NFKC").trim().toUpperCase();
    return {
      normalized: null,
      lookupHash: hashAuthSubject(
        "account",
        `invalid:${canonicalInvalid}`,
        pepper,
      ),
    };
  }
}

function accountCanAttemptLogin(
  account: Awaited<ReturnType<AuthRepository["lookupAccount"]>>,
  timestamp: Date,
): account is NonNullable<typeof account> {
  if (!account) {
    return false;
  }

  if (account.status === "pending" || account.status === "disabled") {
    return false;
  }

  if (
    account.status === "locked" &&
    (!account.lockedUntil || account.lockedUntil.getTime() > timestamp.getTime())
  ) {
    return false;
  }

  if (
    account.mustChangePasscode &&
    account.temporaryExpiresAt &&
    account.temporaryExpiresAt.getTime() <= timestamp.getTime()
  ) {
    return false;
  }

  return true;
}

function safeHexEqual(left: string, right: string): boolean {
  if (!/^[a-f0-9]{64}$/.test(left) || !/^[a-f0-9]{64}$/.test(right)) {
    return false;
  }

  return timingSafeEqual(Buffer.from(left, "hex"), Buffer.from(right, "hex"));
}
