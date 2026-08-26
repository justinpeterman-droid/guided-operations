import "server-only";

import { randomBytes, randomUUID } from "node:crypto";

import { createEmployeeLookupDigest } from "./employee-sign-in";
import type {
  AuthUserProvisioner,
  TemporaryCredentialDelivery,
} from "./first-admin-bootstrap";

const TEMPORARY_PASSCODE_ALPHABET =
  "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
const TEMPORARY_PASSCODE_LENGTH = 20;

export type InviteAccountInput = Readonly<{
  employeeNumber: string;
  employeeNumberHint: string;
  displayName: string;
  role: "officer" | "administrator";
  shiftCode: "A" | "B" | "C" | "D" | "U" | "F";
}>;

export type InvitedAccountStore = Readonly<{
  stage(
    input: Readonly<{
      authUserId: string;
      actorAuthUserId: string;
      employeeLookupDigest: string;
      employeeNumberHint: string;
      displayName: string;
      role: "officer" | "administrator";
      shiftCode: "A" | "B" | "C" | "D" | "U" | "F";
      signInAlias: string;
      temporaryPasscodeExpiresAt: Date;
    }>,
  ): Promise<void>;
  activate(authUserId: string, actorAuthUserId: string): Promise<void>;
  abandon(authUserId: string, actorAuthUserId: string): Promise<void>;
}>;

/** A single-use proof must be consumed before any provider account is created. */
export type AdminInviteAuthorization = Readonly<{
  consume(): Promise<Readonly<{ actorAuthUserId: string }> | null>;
}>;

export type InviteAccountDependencies = Readonly<{
  authorization: AdminInviteAuthorization;
  authUserProvisioner: AuthUserProvisioner;
  store: InvitedAccountStore;
  delivery: TemporaryCredentialDelivery;
  employeeLookupHmacKey: string;
  now?: () => Date;
}>;

export type InviteAccountResult =
  | Readonly<{ status: "activated" }>
  | Readonly<{ status: "denied" }>
  | Readonly<{ status: "failed" }>;

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

async function cleanupPendingInvitation(
  authUserId: string,
  actorAuthUserId: string,
  dependencies: Pick<
    InviteAccountDependencies,
    "authUserProvisioner" | "store"
  >,
): Promise<void> {
  try {
    await dependencies.store.abandon(authUserId, actorAuthUserId);
  } finally {
    await dependencies.authUserProvisioner.deleteUser(authUserId);
  }
}

/**
 * Stages a single invited account after a one-time administrator confirmation.
 * The generated temporary passcode remains in request memory only, reaches the
 * private delivery adapter once, and is never returned to the caller.
 */
export async function inviteAccount(
  input: InviteAccountInput,
  dependencies: InviteAccountDependencies,
): Promise<InviteAccountResult> {
  const authorization = await dependencies.authorization.consume();
  if (!authorization) return { status: "denied" };

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
      actorAuthUserId: authorization.actorAuthUserId,
      employeeLookupDigest,
      employeeNumberHint: input.employeeNumberHint,
      displayName: input.displayName,
      role: input.role,
      shiftCode: input.shiftCode,
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
    await dependencies.store.activate(
      provisioned.authUserId,
      authorization.actorAuthUserId,
    );
    return { status: "activated" };
  } catch {
    try {
      await cleanupPendingInvitation(
        provisioned.authUserId,
        authorization.actorAuthUserId,
        dependencies,
      );
    } catch {
      // A failed cleanup keeps the pending account unable to sign in and is
      // deliberately indistinguishable to the caller.
    }
    return { status: "failed" };
  }
}

export const inviteAccountInternals = {
  createInternalAlias,
  createTemporaryPasscode,
};
