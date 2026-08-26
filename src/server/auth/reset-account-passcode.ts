import "server-only";

import { randomBytes } from "node:crypto";

import { z } from "zod";

import type { AdminActionAuthorization } from "./authorize-admin-action";

const TEMPORARY_PASSCODE_ALPHABET =
  "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
const TEMPORARY_PASSCODE_LENGTH = 20;
const inputSchema = z.object({ targetAuthUserId: z.string().uuid() }).strict();

export type AccountPasscodeResetStore = Readonly<{
  prepare(
    actorAuthUserId: string,
    targetAuthUserId: string,
    temporaryPasscodeExpiresAt: Date,
  ): Promise<void>;
}>;

export type AuthPasswordResetter = Readonly<{
  updatePassword(authUserId: string, passcode: string): Promise<boolean>;
}>;

function createTemporaryPasscode(): string {
  const bytes = randomBytes(TEMPORARY_PASSCODE_LENGTH);
  return Array.from(
    bytes,
    (value) =>
      TEMPORARY_PASSCODE_ALPHABET[value % TEMPORARY_PASSCODE_ALPHABET.length],
  ).join("");
}

/** Creates one expiring reset credential after a purpose-bound admin proof. */
export async function resetAccountPasscode(
  input: unknown,
  dependencies: Readonly<{
    authorization: AdminActionAuthorization;
    store: AccountPasscodeResetStore;
    passwordResetter: AuthPasswordResetter;
    now?: () => Date;
  }>,
): Promise<
  | Readonly<{
      status: "reset";
      temporaryPasscode: string;
      expiresAt: Date;
    }>
  | Readonly<{ status: "denied" | "failed" }>
> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return { status: "denied" };
  const authorization = await dependencies.authorization.consume();
  if (!authorization) return { status: "denied" };

  const temporaryPasscode = createTemporaryPasscode();
  const now = dependencies.now?.() ?? new Date();
  const expiresAt = new Date(now.getTime() + 30 * 60_000);
  try {
    await dependencies.store.prepare(
      authorization.actorAuthUserId,
      parsed.data.targetAuthUserId,
      expiresAt,
    );
    if (
      !(await dependencies.passwordResetter.updatePassword(
        parsed.data.targetAuthUserId,
        temporaryPasscode,
      ))
    )
      return { status: "failed" };
    return { status: "reset", temporaryPasscode, expiresAt };
  } catch {
    return { status: "failed" };
  }
}
