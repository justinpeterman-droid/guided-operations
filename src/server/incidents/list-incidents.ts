import "server-only";

import { z } from "zod";

import {
  authorizeCurrentSession,
  type CurrentSessionClient,
} from "@/server/auth/current-session";

const incidentSummaryRowsSchema = z.array(
  z
    .object({
      incident_id: z.uuid(),
      incident_number: z.string().min(1).max(80),
      display_name: z.string().min(1).max(160),
      status: z.enum(["draft", "in_review", "complete", "archived"]),
      occurred_at: z.iso.datetime({ offset: true }),
      category: z.string().min(1).max(100),
      current_revision_number: z.number().int().nonnegative(),
      updated_at: z.iso.datetime({ offset: true }),
    })
    .strict(),
);

type IncidentListRpcClient = Readonly<{
  rpc(
    functionName: "list_incidents",
    arguments_: Readonly<{ p_limit: number }>,
  ): PromiseLike<Readonly<{ data: unknown; error: unknown | null }>>;
  rpc(
    functionName: "get_incident_summary",
    arguments_: Readonly<{ p_incident_id: string }>,
  ): PromiseLike<Readonly<{ data: unknown; error: unknown | null }>>;
}>;

export type ListIncidentsSessionClient = CurrentSessionClient &
  IncidentListRpcClient;

export type IncidentSummary = Readonly<{
  incidentId: string;
  incidentNumber: string;
  displayName: string;
  status: "draft" | "in_review" | "complete" | "archived";
  occurredAt: string;
  category: string;
  currentRevisionNumber: number;
  updatedAt: string;
}>;

export type ListIncidentsResult =
  | Readonly<{ kind: "listed"; incidents: readonly IncidentSummary[] }>
  | Readonly<{ kind: "denied" }>
  | Readonly<{ kind: "unavailable" }>;

export type GetIncidentSummaryResult =
  | Readonly<{ kind: "found"; incident: IncidentSummary }>
  | Readonly<{ kind: "denied" }>
  | Readonly<{ kind: "not_found" }>
  | Readonly<{ kind: "unavailable" }>;

function mapIncidentSummary(
  row: z.infer<typeof incidentSummaryRowsSchema>[number],
): IncidentSummary {
  return {
    incidentId: row.incident_id,
    incidentNumber: row.incident_number,
    displayName: row.display_name,
    status: row.status,
    occurredAt: row.occurred_at,
    category: row.category,
    currentRevisionNumber: row.current_revision_number,
    updatedAt: row.updated_at,
  };
}

/**
 * Resolves the current account first, then maps a narrow RPC to safe list
 * summaries. The browser never receives notes, facts, or facility scope.
 */
export async function listIncidentsForCurrentSession(
  client: ListIncidentsSessionClient,
  limit: number,
): Promise<ListIncidentsResult> {
  const session = await authorizeCurrentSession(client);
  if (!session.allowed) return { kind: "denied" };

  try {
    const result = await client.rpc("list_incidents", { p_limit: limit });
    if (result.error) return { kind: "unavailable" };

    const rows = incidentSummaryRowsSchema.safeParse(result.data);
    if (!rows.success) return { kind: "unavailable" };

    return {
      kind: "listed",
      incidents: rows.data.map(mapIncidentSummary),
    };
  } catch {
    return { kind: "unavailable" };
  }
}

/** Loads one authorized incident without depending on a capped global list. */
export async function getIncidentSummaryForCurrentSession(
  incidentIdCandidate: unknown,
  client: ListIncidentsSessionClient,
): Promise<GetIncidentSummaryResult> {
  const incidentId = z.uuid().safeParse(incidentIdCandidate);
  if (!incidentId.success) return { kind: "not_found" };

  const session = await authorizeCurrentSession(client);
  if (!session.allowed) return { kind: "denied" };
  try {
    const result = await client.rpc("get_incident_summary", {
      p_incident_id: incidentId.data,
    });
    if (result.error) return { kind: "unavailable" };
    const rows = incidentSummaryRowsSchema.max(1).safeParse(result.data);
    if (!rows.success) return { kind: "unavailable" };
    if (rows.data.length === 0) return { kind: "not_found" };
    return { kind: "found", incident: mapIncidentSummary(rows.data[0]) };
  } catch {
    return { kind: "unavailable" };
  }
}
