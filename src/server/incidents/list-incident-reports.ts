import "server-only";

import { z } from "zod";

import { reportTypeSchema } from "@/features/incidents/report-types";
import {
  authorizeCurrentSession,
  type CurrentSessionClient,
} from "@/server/auth/current-session";
import type { ReportSummary } from "@/server/incidents/list-reports";

const incidentIdSchema = z.uuid();
const rowsSchema = z.array(
  z
    .object({
      report_id: z.uuid(),
      incident_number: z.string().min(1).max(80),
      incident_name: z.string().min(1).max(160),
      report_type: reportTypeSchema,
      status: z.enum(["draft", "in_review", "complete", "archived"]),
      current_revision_number: z.number().int().positive(),
      updated_at: z.iso.datetime({ offset: true }),
    })
    .strict(),
);

type ListIncidentReportsRpcClient = Readonly<{
  rpc(
    functionName: "list_incident_reports",
    arguments_: Readonly<{ p_incident_id: string }>,
  ): PromiseLike<Readonly<{ data: unknown; error: unknown | null }>>;
}>;

export type ListIncidentReportsSessionClient = CurrentSessionClient &
  ListIncidentReportsRpcClient;

export type ListIncidentReportsResult =
  | Readonly<{ kind: "listed"; reports: readonly ReportSummary[] }>
  | Readonly<{ kind: "denied" }>
  | Readonly<{ kind: "not_found" }>
  | Readonly<{ kind: "unavailable" }>;

/** Loads every report authorized for one incident without a global list cap. */
export async function listReportsForIncidentForCurrentSession(
  incidentId: unknown,
  client: ListIncidentReportsSessionClient,
): Promise<ListIncidentReportsResult> {
  const parsedIncidentId = incidentIdSchema.safeParse(incidentId);
  if (!parsedIncidentId.success) return { kind: "not_found" };

  const session = await authorizeCurrentSession(client);
  if (!session.allowed) return { kind: "denied" };

  try {
    const result = await client.rpc("list_incident_reports", {
      p_incident_id: parsedIncidentId.data,
    });
    if (result.error) return { kind: "unavailable" };

    const rows = rowsSchema.safeParse(result.data);
    if (!rows.success) return { kind: "unavailable" };

    return {
      kind: "listed",
      reports: rows.data.map((row) => ({
        reportId: row.report_id,
        incidentNumber: row.incident_number,
        incidentName: row.incident_name,
        reportType: row.report_type,
        status: row.status,
        currentRevisionNumber: row.current_revision_number,
        updatedAt: row.updated_at,
      })),
    };
  } catch {
    return { kind: "unavailable" };
  }
}
