import "server-only";

import { z } from "zod";

import {
  calculateCountTotals,
  validateCountPayload,
} from "@/features/count-sheet/calculations";
import { isApprovedCountSheetStructure } from "@/features/count-sheet/approved-structure";
import { parseCountSheetStructure } from "@/features/count-sheet/schema";
import type { CountSheetPayload } from "@/features/count-sheet/types";
import {
  authorizeCurrentSession,
  type CurrentSessionClient,
} from "@/server/auth/current-session";

const summaryRowsSchema = z.array(
  z
    .object({
      revision_number: z.number().int().positive(),
      reason: z.string().max(500),
      validation: z.unknown(),
      created_at: z.iso.datetime({ offset: true }),
      is_current: z.boolean(),
      restored_from_revision_number: z.number().int().positive().nullable(),
    })
    .strict(),
);

const detailRowsSchema = z
  .array(
    z
      .object({
        record_id: z.uuid(),
        work_date: z.iso.date(),
        shift_code: z.enum(["A", "B", "C", "D", "U", "F"]),
        current_revision_number: z.number().int().positive(),
        revision_number: z.number().int().positive(),
        reason: z.string().max(500),
        structure: z.unknown(),
        payload: z.unknown(),
        validation: z.unknown(),
        restored_from_revision_number: z.number().int().positive().nullable(),
        created_at: z.iso.datetime({ offset: true }),
      })
      .strict(),
  )
  .max(1);

type CountSheetHistoryClient = CurrentSessionClient &
  Readonly<{
    rpc(
      name: "list_count_sheet_revisions",
      args: Readonly<{ p_record_id: string }>,
    ): PromiseLike<Readonly<{ data: unknown; error: unknown | null }>>;
    rpc(
      name: "get_count_sheet_revision",
      args: Readonly<{ p_record_id: string; p_revision_number: number }>,
    ): PromiseLike<Readonly<{ data: unknown; error: unknown | null }>>;
  }>;

export type CountSheetRevisionSummary = Readonly<{
  revisionNumber: number;
  reason: string;
  validation: ReturnType<typeof calculateCountTotals>;
  createdAt: string;
  isCurrent: boolean;
  restoredFromRevisionNumber: number | null;
}>;

export type CountSheetRevisionDetail = Readonly<{
  recordId: string;
  workDate: string;
  shiftCode: "A" | "B" | "C" | "D" | "U" | "F";
  currentRevisionNumber: number;
  revisionNumber: number;
  reason: string;
  payload: CountSheetPayload;
  validation: ReturnType<typeof calculateCountTotals>;
  restoredFromRevisionNumber: number | null;
  createdAt: string;
}>;

export async function listCountSheetRevisionsForCurrentSession(
  recordIdCandidate: unknown,
  client: CountSheetHistoryClient,
) {
  const recordId = z.uuid().safeParse(recordIdCandidate);
  if (!recordId.success) return { kind: "not_found" as const };
  if (!(await authorizeCurrentSession(client)).allowed)
    return { kind: "denied" as const };

  try {
    const result = await client.rpc("list_count_sheet_revisions", {
      p_record_id: recordId.data,
    });
    const rows = !result.error
      ? summaryRowsSchema.safeParse(result.data)
      : null;
    if (!rows?.success) return { kind: "unavailable" as const };

    const revisions: CountSheetRevisionSummary[] = [];
    for (const row of rows.data) {
      const validation = calculateCountTotalsFromStored(row.validation);
      if (!validation) return { kind: "unavailable" as const };
      revisions.push({
        revisionNumber: row.revision_number,
        reason: row.reason,
        validation,
        createdAt: row.created_at,
        isCurrent: row.is_current,
        restoredFromRevisionNumber: row.restored_from_revision_number,
      });
    }
    return { kind: "listed" as const, revisions };
  } catch {
    return { kind: "unavailable" as const };
  }
}

export async function getCountSheetRevisionForCurrentSession(
  recordIdCandidate: unknown,
  revisionNumberCandidate: unknown,
  client: CountSheetHistoryClient,
) {
  const recordId = z.uuid().safeParse(recordIdCandidate);
  const revisionNumber = z.coerce
    .number()
    .int()
    .positive()
    .safeParse(revisionNumberCandidate);
  if (!recordId.success || !revisionNumber.success)
    return { kind: "not_found" as const };
  if (!(await authorizeCurrentSession(client)).allowed)
    return { kind: "denied" as const };

  try {
    const result = await client.rpc("get_count_sheet_revision", {
      p_record_id: recordId.data,
      p_revision_number: revisionNumber.data,
    });
    const rows = !result.error ? detailRowsSchema.safeParse(result.data) : null;
    if (!rows?.success) return { kind: "unavailable" as const };
    if (rows.data.length !== 1) return { kind: "not_found" as const };

    const row = rows.data[0];
    const structure = parseCountSheetStructure(row.structure);
    if (!isApprovedCountSheetStructure(structure))
      return { kind: "unavailable" as const };
    const payload = validateCountPayload(
      structure,
      row.payload as CountSheetPayload,
    );
    const validation = calculateCountTotals(structure, payload);
    if (JSON.stringify(validation) !== JSON.stringify(row.validation))
      return { kind: "unavailable" as const };

    return {
      kind: "found" as const,
      revision: {
        recordId: row.record_id,
        workDate: row.work_date,
        shiftCode: row.shift_code,
        currentRevisionNumber: row.current_revision_number,
        revisionNumber: row.revision_number,
        reason: row.reason,
        payload,
        validation,
        restoredFromRevisionNumber: row.restored_from_revision_number,
        createdAt: row.created_at,
      } satisfies CountSheetRevisionDetail,
    };
  } catch {
    return { kind: "unavailable" as const };
  }
}

function calculateCountTotalsFromStored(value: unknown) {
  const schema = z
    .object({
      row_totals: z.record(z.string(), z.number().int().min(0)),
      out_of_housing: z.record(z.string(), z.number().int().min(0)),
      unit_totals: z.record(z.string(), z.number().int().min(0)),
      column_totals: z.record(z.string(), z.number().int().min(0)),
      housing_total: z.number().int().min(0),
      operational_total: z.number().int().min(0),
      difference: z.number().int(),
      reconciled: z.boolean(),
    })
    .strict()
    .safeParse(value);
  return schema.success ? schema.data : null;
}
