import "server-only";

import { z } from "zod";

import type { CurrentAccount } from "./current-account";

const accountRowsSchema = z
  .array(
    z
      .object({
        auth_user_id: z.uuid(),
        facility_id: z.uuid(),
        role: z.enum(["officer", "administrator"]),
        status: z.enum(["pending", "active", "locked", "disabled"]),
        auth_version: z.number().int().positive(),
        must_change_passcode: z.boolean(),
      })
      .strict(),
  )
  .max(1);

export type CurrentAccountRpcClient = Readonly<{
  rpc(
    functionName: "current_account",
  ): PromiseLike<Readonly<{ data: unknown; error: unknown | null }>>;
}>;

/**
 * Maps the narrow current-account RPC into the trusted domain type. Provider
 * failures and malformed responses become no account; callers must fail closed
 * without exposing a provider/database error to the browser.
 */
export async function loadCurrentAccountFromRpc(
  client: CurrentAccountRpcClient,
): Promise<CurrentAccount | null> {
  try {
    const result = await client.rpc("current_account");
    if (result.error) return null;

    const parsed = accountRowsSchema.safeParse(result.data);
    if (!parsed.success || parsed.data.length !== 1) return null;

    const row = parsed.data[0];
    return {
      authUserId: row.auth_user_id,
      facilityId: row.facility_id,
      role: row.role,
      status: row.status,
      authVersion: row.auth_version,
      mustChangePasscode: row.must_change_passcode,
    };
  } catch {
    return null;
  }
}
