import "server-only";

import { z } from "zod";

import type { AdminActionAuthorization } from "./authorize-admin-action";
import { createTemporaryPasscode } from "./temporary-passcode";
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
