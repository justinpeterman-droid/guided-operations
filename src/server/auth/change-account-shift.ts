import "server-only";

import { z } from "zod";

import type { AdminActionAuthorization } from "./authorize-admin-action";

export type ShiftCode = "A" | "B" | "C" | "D" | "U" | "F";

export type AccountShiftChangeStore = Readonly<{
  changeShift(
    actorAuthUserId: string,
    targetAuthUserId: string,
    newShiftCode: ShiftCode,
  ): Promise<void>;
}>;

const inputSchema = z
  .object({
    targetAuthUserId: z.uuid(),
    newShiftCode: z.enum(["A", "B", "C", "D", "U", "F"]),
  })
  .strict();

/** Applies one purpose-approved same-facility account shift change. */
export async function changeAccountShift(
  input: unknown,
  dependencies: Readonly<{
    authorization: AdminActionAuthorization;
    store: AccountShiftChangeStore;
  }>,
): Promise<"changed" | "denied" | "failed"> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return "denied";
  const authorization = await dependencies.authorization.consume();
  if (!authorization) return "denied";
  try {
    await dependencies.store.changeShift(
      authorization.actorAuthUserId,
      parsed.data.targetAuthUserId,
      parsed.data.newShiftCode,
    );
    return "changed";
  } catch {
    return "failed";
  }
}
