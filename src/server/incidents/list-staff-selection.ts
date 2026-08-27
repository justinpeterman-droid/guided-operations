import "server-only";

import { z } from "zod";

import {
  authorizeCurrentSession,
  type CurrentSessionClient,
} from "@/server/auth/current-session";

const staffSelectionRowsSchema = z
  .array(
    z
      .object({
        staff_member_id: z.uuid(),
        display_name: z.string().trim().min(1).max(160),
        employee_number_hint: z.string().trim().min(2).max(8),
        shift_code: z.enum(["A", "B", "C", "D", "U", "F"]).nullable(),
        is_current_account: z.boolean(),
      })
      .strict(),
  )
  .max(100);

type StaffSelectionRpcClient = Readonly<{
  rpc(
    functionName: "list_staff_selection",
    arguments_: Readonly<{ p_limit: number }>,
  ): PromiseLike<Readonly<{ data: unknown; error: unknown | null }>>;
}>;

export type ListStaffSelectionSessionClient = CurrentSessionClient &
  StaffSelectionRpcClient;

export type StaffSelectionItem = Readonly<{
  staffMemberId: string;
  displayName: string;
  employeeNumberHint: string;
  shiftCode: "A" | "B" | "C" | "D" | "U" | "F" | null;
  isCurrentAccount: boolean;
}>;

export type ListStaffSelectionResult =
  | Readonly<{ kind: "listed"; staff: readonly StaffSelectionItem[] }>
  | Readonly<{ kind: "denied" }>
  | Readonly<{ kind: "unavailable" }>;

/** Returns only active same-facility roster fields needed for attribution. */
export async function listStaffSelectionForCurrentSession(
  client: ListStaffSelectionSessionClient,
  limit: number,
): Promise<ListStaffSelectionResult> {
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    return { kind: "unavailable" };
  }

  const session = await authorizeCurrentSession(client);
  if (!session.allowed) return { kind: "denied" };

  try {
    const result = await client.rpc("list_staff_selection", {
      p_limit: limit,
    });
    if (result.error) return { kind: "unavailable" };

    const rows = staffSelectionRowsSchema.safeParse(result.data);
    if (!rows.success) return { kind: "unavailable" };
    if (rows.data.filter((row) => row.is_current_account).length !== 1) {
      return { kind: "unavailable" };
    }

    return {
      kind: "listed",
      staff: rows.data.map((row) => ({
        staffMemberId: row.staff_member_id,
        displayName: row.display_name,
        employeeNumberHint: row.employee_number_hint,
        shiftCode: row.shift_code,
        isCurrentAccount: row.is_current_account,
      })),
    };
  } catch {
    return { kind: "unavailable" };
  }
}
