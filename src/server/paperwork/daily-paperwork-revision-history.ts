import "server-only";

import { z } from "zod";

import {
  parseDailyPaperworkFormSchema,
  parseDailyPaperworkPayload,
  type DailyPaperworkFormSchema,
  type DailyPaperworkPayload,
} from "@/features/daily-paperwork/form-schema";
import {
  dailyPaperworkKindSchema,
  shiftCodeSchema,
} from "@/features/daily-paperwork/catalog";
import {
  authorizeCurrentSession,
  type CurrentSessionClient,
} from "@/server/auth/current-session";

const summaryRowsSchema = z.array(
  z
    .object({
      revision_number: z.number().int().positive(),
      reason: z.string().min(1).max(500),
      template_version: z.number().int().positive(),
      source_revision: z.string().min(1).max(160),
      created_at: z.iso.datetime({ offset: true }),
      is_current: z.boolean(),
      restored_from_revision_number: z.number().int().positive().nullable(),
    })
    .strict(),
);

const validationSchema = z
  .object({
    schema_version: z.literal(1),
    valid: z.literal(true),
    field_count: z.number().int().min(0).max(256),
    table_count: z.number().int().min(0).max(32),
    row_count: z.number().int().min(0).max(16_000),
  })
  .strict();

const detailRowsSchema = z
  .array(
    z
      .object({
        record_id: z.uuid(),
        template_code: dailyPaperworkKindSchema,
        work_date: z.iso.date(),
        shift_code: shiftCodeSchema,
        current_revision_number: z.number().int().positive(),
        revision_number: z.number().int().positive(),
        reason: z.string().min(1).max(500),
        template_id: z.uuid(),
        template_version: z.number().int().positive(),
        source_revision: z.string().min(1).max(160),
        source_sha256: z.string().regex(/^[a-f0-9]{64}$/),
        print_orientation: z.enum(["portrait", "landscape"]),
        capabilities: z
          .array(z.enum(["screen", "print", "pdf"]))
          .min(1)
          .max(3),
        structure: z.unknown(),
        field_schema: z.unknown(),
        payload: z.unknown(),
        validation: validationSchema,
        restored_from_revision_number: z.number().int().positive().nullable(),
        created_at: z.iso.datetime({ offset: true }),
      })
      .strict(),
  )
  .max(1);

type DailyPaperworkHistoryClient = CurrentSessionClient &
  Readonly<{
    rpc(
      name: "list_daily_paperwork_revisions_v2",
      args: Readonly<{ p_record_id: string }>,
    ): PromiseLike<Readonly<{ data: unknown; error: unknown | null }>>;
    rpc(
      name: "get_daily_paperwork_revision_v2",
      args: Readonly<{
        p_record_id: string;
        p_revision_number: number;
      }>,
    ): PromiseLike<Readonly<{ data: unknown; error: unknown | null }>>;
  }>;

export type DailyPaperworkRevisionSummary = Readonly<{
  revisionNumber: number;
  reason: string;
  templateVersion: number;
  sourceRevision: string;
  createdAt: string;
  isCurrent: boolean;
  restoredFromRevisionNumber: number | null;
}>;

export type DailyPaperworkRevisionDetail = Readonly<{
  recordId: string;
  kind: z.infer<typeof dailyPaperworkKindSchema>;
  workDate: string;
  shiftCode: z.infer<typeof shiftCodeSchema>;
  currentRevisionNumber: number;
  revisionNumber: number;
  reason: string;
  templateId: string;
  templateVersion: number;
  sourceRevision: string;
  sourceSha256: string;
  printOrientation: "portrait" | "landscape";
  capabilities: readonly ("screen" | "print" | "pdf")[];
  structure: Readonly<Record<string, unknown>>;
  fieldSchema: DailyPaperworkFormSchema;
  payload: DailyPaperworkPayload;
  validation: z.infer<typeof validationSchema>;
  restoredFromRevisionNumber: number | null;
  createdAt: string;
}>;

export async function listDailyPaperworkRevisionsForCurrentSession(
  recordIdCandidate: unknown,
  client: DailyPaperworkHistoryClient,
) {
  const recordId = z.uuid().safeParse(recordIdCandidate);
  if (!recordId.success) return { kind: "not_found" as const };
  if (
    !(
      await authorizeCurrentSession(client, {
        requiredRole: "administrator",
      })
    ).allowed
  )
    return { kind: "denied" as const };
  try {
    const result = await client.rpc("list_daily_paperwork_revisions_v2", {
      p_record_id: recordId.data,
    });
    const rows = !result.error
      ? summaryRowsSchema.safeParse(result.data)
      : null;
    if (!rows?.success) return { kind: "unavailable" as const };
    if (rows.data.length === 0) return { kind: "not_found" as const };
    return {
      kind: "listed" as const,
      revisions: rows.data.map((row) => ({
        revisionNumber: row.revision_number,
        reason: row.reason,
        templateVersion: row.template_version,
        sourceRevision: row.source_revision,
        createdAt: row.created_at,
        isCurrent: row.is_current,
        restoredFromRevisionNumber: row.restored_from_revision_number,
      })) satisfies DailyPaperworkRevisionSummary[],
    };
  } catch {
    return { kind: "unavailable" as const };
  }
}

export async function getDailyPaperworkRevisionForCurrentSession(
  recordIdCandidate: unknown,
  revisionNumberCandidate: unknown,
  client: DailyPaperworkHistoryClient,
) {
  const recordId = z.uuid().safeParse(recordIdCandidate);
  const revisionNumber = z.coerce
    .number()
    .int()
    .positive()
    .safeParse(revisionNumberCandidate);
  if (!recordId.success || !revisionNumber.success)
    return { kind: "not_found" as const };
  if (
    !(
      await authorizeCurrentSession(client, {
        requiredRole: "administrator",
      })
    ).allowed
  )
    return { kind: "denied" as const };
  try {
    const result = await client.rpc("get_daily_paperwork_revision_v2", {
      p_record_id: recordId.data,
      p_revision_number: revisionNumber.data,
    });
    const rows = !result.error ? detailRowsSchema.safeParse(result.data) : null;
    if (!rows?.success) return { kind: "unavailable" as const };
    if (rows.data.length !== 1) return { kind: "not_found" as const };
    const row = rows.data[0];
    if (!isRecord(row.structure)) return { kind: "unavailable" as const };
    const fieldSchema = parseDailyPaperworkFormSchema(row.field_schema);
    const payload = parseDailyPaperworkPayload(fieldSchema, row.payload);
    if (
      row.validation.field_count !== fieldSchema.fields.length ||
      row.validation.table_count !== fieldSchema.tables.length ||
      row.validation.row_count !==
        Object.values(payload.tables).reduce(
          (count, tableRows) => count + tableRows.length,
          0,
        )
    )
      return { kind: "unavailable" as const };
    return {
      kind: "found" as const,
      revision: {
        recordId: row.record_id,
        kind: row.template_code,
        workDate: row.work_date,
        shiftCode: row.shift_code,
        currentRevisionNumber: row.current_revision_number,
        revisionNumber: row.revision_number,
        reason: row.reason,
        templateId: row.template_id,
        templateVersion: row.template_version,
        sourceRevision: row.source_revision,
        sourceSha256: row.source_sha256,
        printOrientation: row.print_orientation,
        capabilities: row.capabilities,
        structure: row.structure,
        fieldSchema,
        payload,
        validation: row.validation,
        restoredFromRevisionNumber: row.restored_from_revision_number,
        createdAt: row.created_at,
      } satisfies DailyPaperworkRevisionDetail,
    };
  } catch {
    return { kind: "unavailable" as const };
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
