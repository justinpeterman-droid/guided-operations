import "server-only";

import { z } from "zod";

import {
  dailyPaperworkCatalog,
  dailyPaperworkKindSchema,
  shiftCodeSchema,
  type ShiftCode,
} from "@/features/daily-paperwork/catalog";
import {
  authorizeCurrentSession,
  type CurrentSessionClient,
} from "@/server/auth/current-session";

const commandSchema = z
  .object({
    workDate: z.iso.date(),
    shiftCode: shiftCodeSchema,
  })
  .strict();

const rowSchema = z
  .object({
    template_code: dailyPaperworkKindSchema,
    display_title: z.string().trim().min(1).max(160),
    configured: z.boolean(),
    template_id: z.uuid().nullable(),
    template_version: z.number().int().positive().nullable(),
    print_orientation: z.enum(["portrait", "landscape"]).nullable(),
    capabilities: z
      .array(z.enum(["screen", "print", "pdf"]))
      .max(3)
      .refine((items) => new Set(items).size === items.length),
    record_id: z.uuid().nullable(),
    current_revision_number: z.number().int().nonnegative().nullable(),
    updated_at: z.iso.datetime({ offset: true }).nullable(),
  })
  .strict()
  .superRefine((row, context) => {
    const templateFields = [
      row.template_id,
      row.template_version,
      row.print_orientation,
    ];
    if (row.configured !== templateFields.every((value) => value !== null)) {
      context.addIssue({
        code: "custom",
        message: "Configured template metadata is inconsistent",
      });
    }
    if (
      (row.record_id === null) !== (row.current_revision_number === null) ||
      (row.record_id === null) !== (row.updated_at === null)
    ) {
      context.addIssue({
        code: "custom",
        message: "Daily Paperwork record metadata is inconsistent",
      });
    }
  });

const rowsSchema = z.array(rowSchema).length(dailyPaperworkCatalog.length);

type DailyPaperworkStatusRpcClient = Readonly<{
  rpc(
    name: "list_daily_paperwork_status_v2",
    args: Readonly<{ p_work_date: string; p_shift_code: ShiftCode }>,
  ): PromiseLike<Readonly<{ data: unknown; error: unknown | null }>>;
}>;

export type DailyPaperworkStatusClient = CurrentSessionClient &
  DailyPaperworkStatusRpcClient;

export type DailyPaperworkStatus = Readonly<{
  kind: z.infer<typeof dailyPaperworkKindSchema>;
  title: string;
  configured: boolean;
  templateId: string | null;
  templateVersion: number | null;
  recordId: string | null;
  currentRevisionNumber: number | null;
  updatedAt: string | null;
}>;

export type ListDailyPaperworkStatusResult =
  | Readonly<{ kind: "listed"; forms: readonly DailyPaperworkStatus[] }>
  | Readonly<{ kind: "denied" }>
  | Readonly<{ kind: "unavailable" }>;

/**
 * Returns only bounded Daily Paperwork availability/head metadata. The catalog
 * does not serialize private form definitions into the administrator home.
 */
export async function listDailyPaperworkStatusForCurrentSession(
  candidate: unknown,
  client: DailyPaperworkStatusClient,
): Promise<ListDailyPaperworkStatusResult> {
  const command = commandSchema.safeParse(candidate);
  if (!command.success) return { kind: "denied" };

  const session = await authorizeCurrentSession(client, {
    requiredRole: "administrator",
  });
  if (!session.allowed) return { kind: "denied" };

  try {
    const result = await client.rpc("list_daily_paperwork_status_v2", {
      p_work_date: command.data.workDate,
      p_shift_code: command.data.shiftCode,
    });
    if (result.error) return { kind: "unavailable" };

    const rows = rowsSchema.safeParse(result.data);
    if (!rows.success) return { kind: "unavailable" };
    const expectedKinds = dailyPaperworkCatalog.map((item) => item.kind);
    if (
      rows.data.some(
        (row, index) =>
          row.template_code !== expectedKinds[index] ||
          row.display_title !== dailyPaperworkCatalog[index]?.title,
      )
    ) {
      return { kind: "unavailable" };
    }

    return {
      kind: "listed",
      forms: rows.data.map((row) => ({
        kind: row.template_code,
        title: row.display_title,
        configured: row.configured,
        templateId: row.template_id,
        templateVersion: row.template_version,
        recordId: row.record_id,
        currentRevisionNumber: row.current_revision_number,
        updatedAt: row.updated_at,
      })),
    };
  } catch {
    return { kind: "unavailable" };
  }
}
