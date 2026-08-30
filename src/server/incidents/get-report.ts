import "server-only";

import { z } from "zod";

import {
  reportTypeSchema,
  type ReportType,
} from "@/features/incidents/report-types";

import {
  authorizeCurrentSession,
  type CurrentSessionClient,
} from "@/server/auth/current-session";

const reportRowsSchema = z.array(
  z
    .object({
      report_id: z.uuid(),
      incident_id: z.uuid(),
      report_type: reportTypeSchema,
      status: z.enum(["draft", "in_review", "complete", "archived"]),
      revision_number: z.number().int().positive(),
      report_revision_id: z.uuid(),
      source_incident_revision_id: z.uuid(),
      narrative: z.string().min(1).max(50_000),
      schema_version: z.number().int().positive(),
      created_at: z.iso.datetime({ offset: true }),
    })
    .strict(),
);

type ReportReadRpcClient = Readonly<{
  rpc(
    functionName: "get_report",
    arguments_: Readonly<{ p_report_id: string }>,
  ): PromiseLike<Readonly<{ data: unknown; error: unknown | null }>>;
}>;

export type GetReportSessionClient = CurrentSessionClient & ReportReadRpcClient;

export type AuthorizedReport = Readonly<{
  reportId: string;
  incidentId: string;
  reportType: ReportType;
  status: "draft" | "in_review" | "complete" | "archived";
  revisionNumber: number;
  reportRevisionId: string;
  sourceIncidentRevisionId: string;
  narrative: string;
  schemaVersion: number;
  createdAt: string;
}>;

export type GetReportResult =
  | Readonly<{ kind: "found"; report: AuthorizedReport }>
  | Readonly<{ kind: "denied" }>
  | Readonly<{ kind: "not_found" }>
  | Readonly<{ kind: "unavailable" }>;

/** Returns the current immutable report revision only after session authority. */
export async function getReportForCurrentSession(
  reportIdCandidate: unknown,
  client: GetReportSessionClient,
): Promise<GetReportResult> {
  const reportId = z.uuid().safeParse(reportIdCandidate);
  if (!reportId.success) return { kind: "not_found" };

  const session = await authorizeCurrentSession(client);
  if (!session.allowed) return { kind: "denied" };

  try {
    const result = await client.rpc("get_report", {
      p_report_id: reportId.data,
    });
    if (result.error) return { kind: "unavailable" };

    const rows = reportRowsSchema.safeParse(result.data);
    if (!rows.success || rows.data.length > 1) return { kind: "unavailable" };
    if (rows.data.length === 0) return { kind: "not_found" };

    const row = rows.data[0];
    return {
      kind: "found",
      report: {
        reportId: row.report_id,
        incidentId: row.incident_id,
        reportType: row.report_type,
        status: row.status,
        revisionNumber: row.revision_number,
        reportRevisionId: row.report_revision_id,
        sourceIncidentRevisionId: row.source_incident_revision_id,
        narrative: row.narrative,
        schemaVersion: row.schema_version,
        createdAt: row.created_at,
      },
    };
  } catch {
    return { kind: "unavailable" };
  }
}
