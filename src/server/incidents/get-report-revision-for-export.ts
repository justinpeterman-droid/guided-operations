import "server-only";

import { z } from "zod";

import { reportTypeSchema } from "@/features/incidents/report-types";
import {
  authorizeCurrentSession,
  type CurrentSessionClient,
} from "@/server/auth/current-session";

const printableReportTypeSchema = reportTypeSchema.refine(
  (value) => value === "first_person" || value === "cover_letter",
);

const rowsSchema = z.array(
  z
    .object({
      report_id: z.uuid(),
      report_revision_id: z.uuid(),
      revision_number: z.number().int().positive(),
      incident_number: z.string().min(1).max(80),
      incident_name: z.string().min(1).max(160),
      report_type: printableReportTypeSchema,
      narrative: z.string().min(1).max(50_000),
      schema_version: z.number().int().positive(),
      source_incident_revision_id: z.uuid(),
      created_at: z.iso.datetime({ offset: true }),
    })
    .strict(),
);

type Client = CurrentSessionClient &
  Readonly<{
    rpc(
      name: "get_report_revision_for_export",
      args: Readonly<{ p_report_id: string; p_revision_number: number }>,
    ): PromiseLike<Readonly<{ data: unknown; error: unknown | null }>>;
  }>;

export type ExportableReportRevision = Readonly<{
  reportId: string;
  reportRevisionId: string;
  revisionNumber: number;
  incidentNumber: string;
  incidentName: string;
  reportType: "first_person" | "cover_letter";
  narrative: string;
  schemaVersion: number;
  sourceIncidentRevisionId: string;
  createdAt: string;
}>;

export async function getReportRevisionForExport(
  candidate: unknown,
  client: Client,
) {
  const input = z
    .object({ reportId: z.uuid(), revisionNumber: z.number().int().positive() })
    .strict()
    .safeParse(candidate);
  if (!input.success) return { kind: "not_found" as const };
  if (!(await authorizeCurrentSession(client)).allowed)
    return { kind: "denied" as const };

  try {
    const result = await client.rpc("get_report_revision_for_export", {
      p_report_id: input.data.reportId,
      p_revision_number: input.data.revisionNumber,
    });
    if (result.error) return { kind: "unavailable" as const };
    const rows = rowsSchema.safeParse(result.data);
    if (!rows.success || rows.data.length > 1)
      return { kind: "unavailable" as const };
    if (rows.data.length === 0) return { kind: "not_found" as const };
    const row = rows.data[0];
    return {
      kind: "found" as const,
      revision: {
        reportId: row.report_id,
        reportRevisionId: row.report_revision_id,
        revisionNumber: row.revision_number,
        incidentNumber: row.incident_number,
        incidentName: row.incident_name,
        reportType: row.report_type,
        narrative: row.narrative,
        schemaVersion: row.schema_version,
        sourceIncidentRevisionId: row.source_incident_revision_id,
        createdAt: row.created_at,
      } satisfies ExportableReportRevision,
    };
  } catch {
    return { kind: "unavailable" as const };
  }
}
