import "server-only";

import { z } from "zod";

export type AccountDisableAuthorization = Readonly<{
  consume(): Promise<Readonly<{ actorAuthUserId: string }> | null>;
}>;

export type AccountDisableStore = Readonly<{
  disable(actorAuthUserId: string, targetAuthUserId: string): Promise<void>;
}>;

const inputSchema = z.object({ targetAuthUserId: z.string().uuid() }).strict();

/** Applies one already-approved private account disablement. */
export async function disableAccount(
  input: unknown,
  dependencies: Readonly<{
    authorization: AccountDisableAuthorization;
    store: AccountDisableStore;
  }>,
): Promise<"disabled" | "denied" | "failed"> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return "denied";
  const authorization = await dependencies.authorization.consume();
  if (!authorization) return "denied";
  try {
    await dependencies.store.disable(
      authorization.actorAuthUserId,
      parsed.data.targetAuthUserId,
    );
    return "disabled";
  } catch {
    return "failed";
  }
}
