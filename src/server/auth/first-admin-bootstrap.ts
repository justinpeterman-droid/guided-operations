import "server-only";

import { randomBytes, randomUUID } from "node:crypto";

import { createEmployeeLookupDigest } from "./employee-sign-in";

const TEMPORARY_PASSCODE_ALPHABET =
  "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
const TEMPORARY_PASSCODE_LENGTH = 20;

export type FirstAdminBootstrapInput = Readonly<{
  employeeNumber: string;
  employeeNumberHint: string;
  displayName: string;
}>;

export type AuthUserProvisioner = Readonly<{
  createPasswordUser(
    input: Readonly<{ alias: string; passcode: string }>,
  ): Promise<{ authUserId: string } | null>;
  deleteUser(authUserId: string): Promise<void>;
}>;

export type FirstAdminBootstrapStore = Readonly<{
  stage(
    input: Readonly<{
      authUserId: string;
      employeeLookupDigest: string;
      employeeNumberHint: string;
      displayName: string;
      signInAlias: string;
      temporaryPasscodeExpiresAt: Date;
    }>,
  ): Promise<void>;
  activate(authUserId: string): Promise<void>;
  abandon(authUserId: string): Promise<void>;
}>;

/** Delivers exactly once over an owner-approved private channel. */
export type TemporaryCredentialDelivery = Readonly<{
  deliver(
    input: Readonly<{
      employeeNumberHint: string;
      temporaryPasscode: string;
      expiresAt: Date;
    }>,
  ): Promise<void>;
}>;

export type FirstAdminBootstrapDependencies = Readonly<{
  authUserProvisioner: AuthUserProvisioner;
  store: FirstAdminBootstrapStore;
  delivery: TemporaryCredentialDelivery;
  employeeLookupHmacKey: string;
  now?: () => Date;
}>;

export type FirstAdminBootstrapResult =
  { status: "activated" } | { status: "failed" };

function createTemporaryPasscode(): string {
  const bytes = randomBytes(TEMPORARY_PASSCODE_LENGTH);
  return Array.from(
    bytes,
    (value) =>
      TEMPORARY_PASSCODE_ALPHABET[value % TEMPORARY_PASSCODE_ALPHABET.length],
  ).join("");
}

function createInternalAlias(): string {
  return `go-${randomUUID()}@auth.invalid`;
}

async function cleanupPendingBootstrap(
  authUserId: string,
  dependencies: Pick<
    FirstAdminBootstrapDependencies,
    "authUserProvisioner" | "store"
  >,
): Promise<void> {
  try {
    await dependencies.store.abandon(authUserId);
  } finally {
    await dependencies.authUserProvisioner.deleteUser(authUserId);
  }
}

/**
 * Executes a zero-account-only ceremony. The temporary passcode exists only
 * in request memory until the private delivery adapter accepts it; the result
 * intentionally contains neither a credential nor a real identity value.
 */
export async function bootstrapFirstAdministrator(
  input: FirstAdminBootstrapInput,
  dependencies: FirstAdminBootstrapDependencies,
): Promise<FirstAdminBootstrapResult> {
  const now = dependencies.now?.() ?? new Date();
  const temporaryPasscode = createTemporaryPasscode();
  const alias = createInternalAlias();
  const temporaryPasscodeExpiresAt = new Date(now.getTime() + 30 * 60_000);
  const employeeLookupDigest = createEmployeeLookupDigest(
    input.employeeNumber.normalize("NFKC").trim().toUpperCase(),
    dependencies.employeeLookupHmacKey,
  );

  const provisioned = await dependencies.authUserProvisioner.createPasswordUser(
    {
      alias,
      passcode: temporaryPasscode,
    },
  );
  if (!provisioned) return { status: "failed" };

  try {
    await dependencies.store.stage({
      authUserId: provisioned.authUserId,
      employeeLookupDigest,
      employeeNumberHint: input.employeeNumberHint,
      displayName: input.displayName,
      signInAlias: alias,
      temporaryPasscodeExpiresAt,
    });
  } catch {
    await dependencies.authUserProvisioner.deleteUser(provisioned.authUserId);
    return { status: "failed" };
  }

  try {
    await dependencies.delivery.deliver({
      employeeNumberHint: input.employeeNumberHint,
      temporaryPasscode,
      expiresAt: temporaryPasscodeExpiresAt,
    });
    await dependencies.store.activate(provisioned.authUserId);
    return { status: "activated" };
  } catch {
    try {
      await cleanupPendingBootstrap(provisioned.authUserId, dependencies);
    } catch {
      // Cleanup failure is intentionally indistinguishable to callers. The
      // pending account remains unable to sign in and requires operator repair.
    }
    return { status: "failed" };
  }
}

export const firstAdminBootstrapInternals = {
  createInternalAlias,
  createTemporaryPasscode,
};
