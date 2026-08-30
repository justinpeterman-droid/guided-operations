import "server-only";

import { z } from "zod";

import {
  authorizeCurrentSession,
  type CurrentSessionClient,
} from "./current-session";

const rowsSchema = z.array(
  z
    .object({
      event_id: z.uuid(),
      event_type: z.string().min(3).max(128),
      target_type: z.string().min(2).max(64).nullable(),
      outcome: z.string().min(1).max(80).nullable(),
      occurred_at: z.iso.datetime({ offset: true }),
    })
    .strict(),
);

type ListAdminAuditEventsRpcClient = Readonly<{
  rpc(
    functionName: "list_admin_audit_events",
    arguments_: Readonly<{ p_limit: number }>,
  ): PromiseLike<Readonly<{ data: unknown; error: unknown | null }>>;
}>;

export type ListAdminAuditEventsSessionClient = CurrentSessionClient &
  ListAdminAuditEventsRpcClient;

export type AdminAuditEventSummary = Readonly<{
  eventId: string;
  eventType: string;
  targetType: string | null;
  outcome: string | null;
  occurredAt: string;
}>;

export type ListAdminAuditEventsResult =
  | Readonly<{ kind: "listed"; events: readonly AdminAuditEventSummary[] }>
  | Readonly<{ kind: "denied" }>
  | Readonly<{ kind: "unavailable" }>;

/** Returns a redacted audit timeline only to a current administrator. */
export async function listAdminAuditEventsForCurrentSession(
  client: ListAdminAuditEventsSessionClient,
  limit: number,
): Promise<ListAdminAuditEventsResult> {
  const session = await authorizeCurrentSession(client, {
    requiredRole: "administrator",
  });
  if (!session.allowed) return { kind: "denied" };

  try {
    const result = await client.rpc("list_admin_audit_events", {
      p_limit: limit,
    });
    if (result.error) return { kind: "unavailable" };

    const rows = rowsSchema.safeParse(result.data);
    if (!rows.success) return { kind: "unavailable" };

    return {
      kind: "listed",
      events: rows.data.map((row) => ({
        eventId: row.event_id,
        eventType: row.event_type,
        targetType: row.target_type,
        outcome: row.outcome,
        occurredAt: row.occurred_at,
      })),
    };
  } catch {
    return { kind: "unavailable" };
  }
}
