import "server-only";

import { z } from "zod";

import type { AdminActionAuthorization } from "./authorize-admin-action";

export type AccountRole = "officer" | "administrator";

export type AccountRoleChangeStore = Readonly<{
  changeRole(
    actorAuthUserId: string,
    targetAuthUserId: string,
    newRole: AccountRole,
  ): Promise<void>;
}>;

const inputSchema = z
  .object({
    targetAuthUserId: z.string().uuid(),
    newRole: z.enum(["officer", "administrator"]),
  })
  .strict();

/** Applies one purpose-approved account role change. */
export async function changeAccountRole(
  input: unknown,
  dependencies: Readonly<{
    authorization: AdminActionAuthorization;
    store: AccountRoleChangeStore;
  }>,
): Promise<"changed" | "denied" | "failed"> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return "denied";
  const authorization = await dependencies.authorization.consume();
  if (!authorization) return "denied";
  try {
    await dependencies.store.changeRole(
      authorization.actorAuthUserId,
      parsed.data.targetAuthUserId,
      parsed.data.newRole,
    );
    return "changed";
  } catch {
    return "failed";
  }
}
