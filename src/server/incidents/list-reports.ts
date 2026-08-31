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

type ListReportsRpcClient = Readonly<{
  rpc(
    functionName: "list_reports",
    arguments_: Readonly<{ p_limit: number }>,
  ): PromiseLike<Readonly<{ data: unknown; error: unknown | null }>>;
  rpc(
    functionName: "list_incident_reports",
    arguments_: Readonly<{ p_incident_id: string }>,
  ): PromiseLike<Readonly<{ data: unknown; error: unknown | null }>>;
}>;

export type ListReportsSessionClient = CurrentSessionClient &
  ListReportsRpcClient;

export type ReportSummary = Readonly<{
  reportId: string;
  incidentNumber: string;
  incidentName: string;
  reportType: ReportType;
  status: "draft" | "in_review" | "complete" | "archived";
  currentRevisionNumber: number;
  updatedAt: string;
}>;

export type ListReportsResult =
  | Readonly<{ kind: "listed"; reports: readonly ReportSummary[] }>
  | Readonly<{ kind: "denied" }>
  | Readonly<{ kind: "unavailable" }>;

function mapReportSummary(
  row: z.infer<typeof rowsSchema>[number],
): ReportSummary {
  return {
    reportId: row.report_id,
    incidentNumber: row.incident_number,
    incidentName: row.incident_name,
    reportType: row.report_type,
    status: row.status,
    currentRevisionNumber: row.current_revision_number,
    updatedAt: row.updated_at,
  };
}

/** Maps summary-only reports from the authorized list RPC. */
export async function listReportsForCurrentSession(
  client: ListReportsSessionClient,
  limit: number,
): Promise<ListReportsResult> {
  const session = await authorizeCurrentSession(client);
  if (!session.allowed) return { kind: "denied" };
  try {
    const result = await client.rpc("list_reports", { p_limit: limit });
    if (result.error) return { kind: "unavailable" };
    const rows = rowsSchema.safeParse(result.data);
    if (!rows.success) return { kind: "unavailable" };
    return {
      kind: "listed",
      reports: rows.data.map(mapReportSummary),
    };
  } catch {
    return { kind: "unavailable" };
  }
}

/** Returns every authorized active report belonging to one incident. */
export async function listIncidentReportsForCurrentSession(
  incidentIdCandidate: unknown,
  client: ListReportsSessionClient,
): Promise<ListReportsResult> {
  const incidentId = z.uuid().safeParse(incidentIdCandidate);
  if (!incidentId.success) return { kind: "listed", reports: [] };

  const session = await authorizeCurrentSession(client);
  if (!session.allowed) return { kind: "denied" };
  try {
    const result = await client.rpc("list_incident_reports", {
      p_incident_id: incidentId.data,
    });
    if (result.error) return { kind: "unavailable" };
    const rows = rowsSchema.safeParse(result.data);
    if (!rows.success) return { kind: "unavailable" };
    return { kind: "listed", reports: rows.data.map(mapReportSummary) };
  } catch {
    return { kind: "unavailable" };
  }
}
