import "server-only";

import { z } from "zod";

import type { AdminActionAuthorization } from "./authorize-admin-action";

export type AccountUnlockStore = Readonly<{
  unlock(actorAuthUserId: string, targetAuthUserId: string): Promise<void>;
}>;

const inputSchema = z.object({ targetAuthUserId: z.string().uuid() }).strict();

/** Applies one already-approved private account unlock. */
export async function unlockAccount(
  input: unknown,
  dependencies: Readonly<{
    authorization: AdminActionAuthorization;
    store: AccountUnlockStore;
  }>,
): Promise<"unlocked" | "denied" | "failed"> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return "denied";
  const authorization = await dependencies.authorization.consume();
  if (!authorization) return "denied";
  try {
    await dependencies.store.unlock(
      authorization.actorAuthUserId,
      parsed.data.targetAuthUserId,
    );
    return "unlocked";
  } catch {
    return "failed";
  }
}
