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
  type DailyPaperworkKind,
  type ShiftCode,
} from "@/features/daily-paperwork/catalog";
import {
  authorizeCurrentSession,
  type CurrentSessionClient,
} from "@/server/auth/current-session";

const commandSchema = z
  .object({
    kind: dailyPaperworkKindSchema,
    workDate: z.iso.date(),
    shiftCode: shiftCodeSchema,
  })
  .strict();

const validationSchema = z
  .object({
    schema_version: z.literal(1),
    valid: z.literal(true),
    field_count: z.number().int().min(0).max(256),
    table_count: z.number().int().min(0).max(32),
    row_count: z.number().int().min(0).max(16_000),
  })
  .strict();

const rowSchema = z
  .object({
    template_id: z.uuid(),
    controlling_template_id: z.uuid().nullable(),
    template_code: dailyPaperworkKindSchema,
    title: z.string().min(1).max(160),
    template_version: z.number().int().positive(),
    source_revision: z.string().min(1).max(160),
    source_sha256: z.string().regex(/^[a-f0-9]{64}$/),
    print_orientation: z.enum(["portrait", "landscape"]),
    capabilities: z
      .array(z.enum(["screen", "print", "pdf"]))
      .min(1)
      .max(3)
      .refine((items) => new Set(items).size === items.length),
    structure: z.unknown(),
    field_schema: z.unknown(),
    editable: z.boolean(),
    record_id: z.uuid().nullable(),
    current_revision_number: z.number().int().positive().nullable(),
    payload: z.unknown(),
    validation: validationSchema.nullable(),
    reason: z.string().min(1).max(500).nullable(),
    saved_at: z.iso.datetime({ offset: true }).nullable(),
  })
  .strict()
  .superRefine((row, context) => {
    const savedFields = [
      row.current_revision_number,
      row.validation,
      row.reason,
      row.saved_at,
    ];
    if (
      (row.record_id === null) !==
      savedFields.every((value) => value === null)
    ) {
      context.addIssue({
        code: "custom",
        message: "Saved Daily Paperwork metadata is inconsistent",
      });
    }
    if (
      row.editable &&
      (row.controlling_template_id !== row.template_id ||
        !row.capabilities.includes("screen"))
    ) {
      context.addIssue({
        code: "custom",
        message: "Daily Paperwork edit authority is inconsistent",
      });
    }
  });

const rowsSchema = z.array(rowSchema).max(1);

export type GetDailyPaperworkRpcClient = Readonly<{
  rpc(
    name: "get_daily_paperwork_v2",
    args: Readonly<{
      p_template_code: DailyPaperworkKind;
      p_work_date: string;
      p_shift_code: ShiftCode;
    }>,
  ): PromiseLike<Readonly<{ data: unknown; error: unknown | null }>>;
}>;

export type DailyPaperworkDocument = Readonly<{
  kind: DailyPaperworkKind;
  title: string;
  workDate: string;
  shiftCode: ShiftCode;
  templateId: string;
  controllingTemplateId: string | null;
  templateVersion: number;
  sourceRevision: string;
  sourceSha256: string;
  printOrientation: "portrait" | "landscape";
  capabilities: readonly ("screen" | "print" | "pdf")[];
  structure: Readonly<Record<string, unknown>>;
  fieldSchema: DailyPaperworkFormSchema;
  editable: boolean;
  recordId: string | null;
  currentRevisionNumber: number;
  payload: DailyPaperworkPayload;
  validation: z.infer<typeof validationSchema> | null;
  reason: string | null;
  savedAt: string | null;
}>;

export function parseDailyPaperworkRpcRow(
  candidate: unknown,
  expected: Readonly<{
    kind: DailyPaperworkKind;
    workDate: string;
    shiftCode: ShiftCode;
  }>,
): DailyPaperworkDocument | null {
  const row = rowSchema.safeParse(candidate);
  if (!row.success || row.data.template_code !== expected.kind) return null;
  if (!isRecord(row.data.structure)) return null;
  try {
    const fieldSchema = parseDailyPaperworkFormSchema(row.data.field_schema);
    const payload = parseDailyPaperworkPayload(fieldSchema, row.data.payload, {
      allowIncomplete: row.data.record_id === null,
    });
    if (
      row.data.validation &&
      (row.data.validation.field_count !== fieldSchema.fields.length ||
        row.data.validation.table_count !== fieldSchema.tables.length ||
        row.data.validation.row_count !==
          Object.values(payload.tables).reduce(
            (count, rows) => count + rows.length,
            0,
          ))
    )
      return null;

    return {
      kind: row.data.template_code,
      title: row.data.title,
      workDate: expected.workDate,
      shiftCode: expected.shiftCode,
      templateId: row.data.template_id,
      controllingTemplateId: row.data.controlling_template_id,
      templateVersion: row.data.template_version,
      sourceRevision: row.data.source_revision,
      sourceSha256: row.data.source_sha256,
      printOrientation: row.data.print_orientation,
      capabilities: row.data.capabilities,
      structure: row.data.structure,
      fieldSchema,
      editable: row.data.editable,
      recordId: row.data.record_id,
      currentRevisionNumber: row.data.current_revision_number ?? 0,
      payload,
      validation: row.data.validation,
      reason: row.data.reason,
      savedAt: row.data.saved_at,
    };
  } catch {
    return null;
  }
}

export async function getDailyPaperworkForCurrentSession(
  candidate: unknown,
  client: CurrentSessionClient & GetDailyPaperworkRpcClient,
) {
  const command = commandSchema.safeParse(candidate);
  if (!command.success) return { kind: "not_found" as const };
  const session = await authorizeCurrentSession(client, {
    requiredRole: "administrator",
  });
  if (!session.allowed) return { kind: "denied" as const };

  try {
    const result = await client.rpc("get_daily_paperwork_v2", {
      p_template_code: command.data.kind,
      p_work_date: command.data.workDate,
      p_shift_code: command.data.shiftCode,
    });
    const rows = !result.error ? rowsSchema.safeParse(result.data) : null;
    if (!rows?.success) return { kind: "unavailable" as const };
    if (rows.data.length === 0) return { kind: "not_configured" as const };
    const paperwork = parseDailyPaperworkRpcRow(rows.data[0], command.data);
    return paperwork
      ? { kind: "found" as const, paperwork }
      : { kind: "unavailable" as const };
  } catch {
    return { kind: "unavailable" as const };
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
