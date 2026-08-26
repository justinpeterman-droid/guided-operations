import "server-only";

import { z } from "zod";

import {
  calculateCountTotals,
  createBlankCountPayload,
  validateCountPayload,
} from "@/features/count-sheet/calculations";
import {
  APPROVED_COUNT_SHEET_STRUCTURE,
  isApprovedCountSheetStructure,
} from "@/features/count-sheet/approved-structure";
import { parseCountSheetStructure } from "@/features/count-sheet/schema";
import type {
  CountSheetPayload,
  CountSheetTotals,
} from "@/features/count-sheet/types";
import {
  authorizeCurrentSession,
  type CurrentSessionClient,
} from "@/server/auth/current-session";

const summaryRowsSchema = z.array(
  z
    .object({
      record_id: z.uuid(),
      work_date: z.iso.date(),
      shift_code: z.enum(["A", "B", "C", "D", "U", "F"]),
      current_revision_number: z.number().int().positive(),
      validation: z.unknown(),
      updated_at: z.iso.datetime({ offset: true }),
    })
    .strict(),
);

const recordRowsSchema = z
  .array(
    z
      .object({
        record_id: z.uuid(),
        work_date: z.iso.date(),
        shift_code: z.enum(["A", "B", "C", "D", "U", "F"]),
        current_revision_number: z.number().int().positive(),
        structure: z.unknown(),
        payload: z.unknown(),
        validation: z.unknown(),
        created_at: z.iso.datetime({ offset: true }),
        updated_at: z.iso.datetime({ offset: true }),
      })
      .strict(),
  )
  .max(1);

type CountSheetReadClient = CurrentSessionClient &
  Readonly<{
    rpc(
      name: "list_count_sheets",
      args: Readonly<{ p_work_date: string }>,
    ): PromiseLike<Readonly<{ data: unknown; error: unknown | null }>>;
    rpc(
      name: "get_count_sheet",
      args: Readonly<{ p_record_id: string }>,
    ): PromiseLike<Readonly<{ data: unknown; error: unknown | null }>>;
  }>;

export type CurrentShiftCountSheet = Readonly<{
  recordId: string | null;
  workDate: string;
  shiftCode: "A" | "B" | "C" | "D" | "U" | "F";
  revisionNumber: number;
  structure: typeof APPROVED_COUNT_SHEET_STRUCTURE;
  payload: CountSheetPayload;
  validation: CountSheetTotals;
  updatedAt: string | null;
}>;

export type GetCurrentShiftCountSheetResult =
  | Readonly<{ kind: "found"; countSheet: CurrentShiftCountSheet }>
  | Readonly<{ kind: "empty"; countSheet: CurrentShiftCountSheet }>
  | Readonly<{ kind: "unassigned" }>
  | Readonly<{ kind: "denied" }>
  | Readonly<{ kind: "unavailable" }>;

/** Loads only the current account's assigned-shift sheet for one work date. */
export async function getCurrentShiftCountSheet(
  workDateCandidate: unknown,
  client: CountSheetReadClient,
): Promise<GetCurrentShiftCountSheetResult> {
  const workDate = z.iso.date().safeParse(workDateCandidate);
  if (!workDate.success) return { kind: "unavailable" };

  const session = await authorizeCurrentSession(client);
  if (!session.allowed) return { kind: "denied" };
  const shiftCode = session.account.shiftCode;
  if (!shiftCode) return { kind: "unassigned" };

  try {
    const listed = await client.rpc("list_count_sheets", {
      p_work_date: workDate.data,
    });
    const parsedSummaries = !listed.error
      ? summaryRowsSchema.safeParse(listed.data)
      : null;
    if (!parsedSummaries?.success) return { kind: "unavailable" };

    const matching = parsedSummaries.data.filter(
      (row) => row.shift_code === shiftCode,
    );
    if (matching.length > 1) return { kind: "unavailable" };
    if (matching.length === 0) {
      const payload = createBlankCountPayload(APPROVED_COUNT_SHEET_STRUCTURE);
      return {
        kind: "empty",
        countSheet: {
          recordId: null,
          workDate: workDate.data,
          shiftCode,
          revisionNumber: 0,
          structure: APPROVED_COUNT_SHEET_STRUCTURE,
          payload,
          validation: calculateCountTotals(
            APPROVED_COUNT_SHEET_STRUCTURE,
            payload,
          ),
          updatedAt: null,
        },
      };
    }

    const detail = await client.rpc("get_count_sheet", {
      p_record_id: matching[0].record_id,
    });
    const parsedRecords = !detail.error
      ? recordRowsSchema.safeParse(detail.data)
      : null;
    if (!parsedRecords?.success || parsedRecords.data.length !== 1)
      return { kind: "unavailable" };

    const row = parsedRecords.data[0];
    const structure = parseCountSheetStructure(row.structure);
    if (
      row.work_date !== workDate.data ||
      row.shift_code !== shiftCode ||
      row.record_id !== matching[0].record_id ||
      row.current_revision_number !== matching[0].current_revision_number ||
      !isApprovedCountSheetStructure(structure)
    )
      return { kind: "unavailable" };

    const payload = validateCountPayload(
      structure,
      row.payload as CountSheetPayload,
    );
    const validation = calculateCountTotals(structure, payload);
    if (JSON.stringify(validation) !== JSON.stringify(row.validation))
      return { kind: "unavailable" };

    return {
      kind: "found",
      countSheet: {
        recordId: row.record_id,
        workDate: row.work_date,
        shiftCode: row.shift_code,
        revisionNumber: row.current_revision_number,
        structure: APPROVED_COUNT_SHEET_STRUCTURE,
        payload,
        validation,
        updatedAt: row.updated_at,
      },
    };
  } catch {
    return { kind: "unavailable" };
  }
}
