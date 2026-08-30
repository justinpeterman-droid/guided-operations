import "server-only";

import { z } from "zod";

import {
  authorizeCurrentSession,
  type CurrentSessionClient,
} from "@/server/auth/current-session";

const rowsSchema = z.array(
  z
    .object({
      revision_number: z.number().int().positive(),
      reason: z.string().max(500).nullable(),
      created_at: z.iso.datetime({ offset: true }),
      is_current: z.boolean(),
      restored_from_revision_number: z.number().int().positive().nullable(),
    })
    .strict(),
);

type Client = Readonly<{
  rpc(
    name: "list_report_revisions",
    args: Readonly<{ p_report_id: string }>,
  ): PromiseLike<Readonly<{ data: unknown; error: unknown | null }>>;
}>;
export type ListReportRevisionsClient = CurrentSessionClient & Client;
export type ReportRevisionSummary = Readonly<{
  revisionNumber: number;
  reason: string | null;
  createdAt: string;
  isCurrent: boolean;
  restoredFromRevisionNumber: number | null;
}>;

export async function listReportRevisionsForCurrentSession(
  reportIdCandidate: unknown,
  client: ListReportRevisionsClient,
) {
  const reportId = z.uuid().safeParse(reportIdCandidate);
  if (!reportId.success) return { kind: "not_found" as const };
  if (!(await authorizeCurrentSession(client)).allowed)
    return { kind: "denied" as const };
  try {
    const result = await client.rpc("list_report_revisions", {
      p_report_id: reportId.data,
    });
    const rows = !result.error && rowsSchema.safeParse(result.data);
    if (!rows || !rows.success) return { kind: "unavailable" as const };
    return {
      kind: "listed" as const,
      revisions: rows.data.map((row) => ({
        revisionNumber: row.revision_number,
        reason: row.reason,
        createdAt: row.created_at,
        isCurrent: row.is_current,
        restoredFromRevisionNumber: row.restored_from_revision_number,
      })),
    };
  } catch {
    return { kind: "unavailable" as const };
  }
}
