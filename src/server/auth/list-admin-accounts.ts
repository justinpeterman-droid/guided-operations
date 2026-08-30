import "server-only";

import { z } from "zod";

import {
  authorizeCurrentSession,
  type CurrentSessionClient,
} from "./current-session";

const rowsSchema = z.array(
  z
    .object({
      account_id: z.uuid(),
      employee_number_hint: z.string().min(2).max(8),
      display_name: z.string().min(1).max(160),
      shift_code: z.enum(["A", "B", "C", "D", "U", "F"]).nullable(),
      role: z.enum(["officer", "administrator"]),
      status: z.enum(["pending", "active", "locked", "disabled"]),
      must_change_passcode: z.boolean(),
      updated_at: z.iso.datetime({ offset: true }),
    })
    .strict(),
);

type ListAdminAccountsRpcClient = Readonly<{
  rpc(
    functionName: "list_admin_accounts",
    arguments_: Readonly<{ p_limit: number }>,
  ): PromiseLike<Readonly<{ data: unknown; error: unknown | null }>>;
}>;

export type ListAdminAccountsSessionClient = CurrentSessionClient &
  ListAdminAccountsRpcClient;

export type AdminAccountSummary = Readonly<{
  accountId: string;
  employeeNumberHint: string;
  displayName: string;
  shiftCode: "A" | "B" | "C" | "D" | "U" | "F" | null;
  role: "officer" | "administrator";
  status: "pending" | "active" | "locked" | "disabled";
  mustChangePasscode: boolean;
  updatedAt: string;
}>;

export type ListAdminAccountsResult =
  | Readonly<{ kind: "listed"; accounts: readonly AdminAccountSummary[] }>
  | Readonly<{ kind: "denied" }>
  | Readonly<{ kind: "unavailable" }>;

/** Returns only the account summary fields an active administrator needs. */
export async function listAdminAccountsForCurrentSession(
  client: ListAdminAccountsSessionClient,
  limit: number,
): Promise<ListAdminAccountsResult> {
  const session = await authorizeCurrentSession(client, {
    requiredRole: "administrator",
  });
  if (!session.allowed) return { kind: "denied" };

  try {
    const result = await client.rpc("list_admin_accounts", { p_limit: limit });
    if (result.error) return { kind: "unavailable" };

    const rows = rowsSchema.safeParse(result.data);
    if (!rows.success) return { kind: "unavailable" };

    return {
      kind: "listed",
      accounts: rows.data.map((row) => ({
        accountId: row.account_id,
        employeeNumberHint: row.employee_number_hint,
        displayName: row.display_name,
        shiftCode: row.shift_code,
        role: row.role,
        status: row.status,
        mustChangePasscode: row.must_change_passcode,
        updatedAt: row.updated_at,
      })),
    };
  } catch {
    return { kind: "unavailable" };
  }
}
