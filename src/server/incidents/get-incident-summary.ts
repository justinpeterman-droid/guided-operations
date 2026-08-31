import "server-only";

import { z } from "zod";

import {
  authorizeCurrentSession,
  type CurrentSessionClient,
} from "@/server/auth/current-session";
import type { IncidentSummary } from "@/server/incidents/list-incidents";

const incidentIdSchema = z.uuid();
const incidentSummaryRowsSchema = z
  .array(
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
  )
  .max(1);

type GetIncidentSummaryRpcClient = Readonly<{
  rpc(
    functionName: "get_incident_summary",
    arguments_: Readonly<{ p_incident_id: string }>,
  ): PromiseLike<Readonly<{ data: unknown; error: unknown | null }>>;
}>;

export type GetIncidentSummarySessionClient = CurrentSessionClient &
  GetIncidentSummaryRpcClient;

export type GetIncidentSummaryResult =
  | Readonly<{ kind: "found"; incident: IncidentSummary }>
  | Readonly<{ kind: "denied" }>
  | Readonly<{ kind: "not_found" }>
  | Readonly<{ kind: "unavailable" }>;

/** Loads one authorized incident summary without consulting a capped index. */
export async function getIncidentSummaryForCurrentSession(
  incidentId: unknown,
  client: GetIncidentSummarySessionClient,
): Promise<GetIncidentSummaryResult> {
  const parsedIncidentId = incidentIdSchema.safeParse(incidentId);
  if (!parsedIncidentId.success) return { kind: "not_found" };

  const session = await authorizeCurrentSession(client);
  if (!session.allowed) return { kind: "denied" };

  try {
    const result = await client.rpc("get_incident_summary", {
      p_incident_id: parsedIncidentId.data,
    });
    if (result.error) return { kind: "unavailable" };

    const rows = incidentSummaryRowsSchema.safeParse(result.data);
    if (!rows.success) return { kind: "unavailable" };
    const row = rows.data[0];
    if (!row) return { kind: "not_found" };

    return {
      kind: "found",
      incident: {
        incidentId: row.incident_id,
        incidentNumber: row.incident_number,
        displayName: row.display_name,
        status: row.status,
        occurredAt: row.occurred_at,
        category: row.category,
        currentRevisionNumber: row.current_revision_number,
        updatedAt: row.updated_at,
      },
    };
  } catch {
    return { kind: "unavailable" };
  }
}
