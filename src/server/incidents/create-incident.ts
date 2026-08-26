import "server-only";

import { createHmac } from "node:crypto";

import {
  createIncidentCommandSchema,
  type CreateIncidentCommand,
} from "@/features/incidents/commands";
import {
  authorizeCurrentSession,
  type AuthorizedCurrentSession,
  type CurrentSessionClient,
} from "@/server/auth/current-session";
import type { Json } from "@/lib/supabase/database.generated";

const INCIDENT_CREATE_ACTION = "incident.create";

type IncidentCreateRpcArguments = Readonly<{
  p_facility_id: string;
  p_incident_number: string;
  p_display_name: string;
  p_occurred_at: string;
  p_category: string;
  p_schema_version: number;
  p_field_notes: Json;
  p_reviewed_facts: Json;
  p_idempotency_key_digest: string;
  p_request_digest: string;
}>;

type IncidentCreateRpcClient = Readonly<{
  rpc(
    functionName: "create_incident",
    arguments_: IncidentCreateRpcArguments,
  ): PromiseLike<Readonly<{ data: unknown; error: unknown | null }>>;
}>;

export type CreateIncidentSessionClient = CurrentSessionClient &
  IncidentCreateRpcClient;

export type CreateIncidentResult =
  | Readonly<{ kind: "created"; incidentId: string }>
  | Readonly<{ kind: "denied" }>
  | Readonly<{ kind: "unavailable" }>;

function digest(value: string, key: string, purpose: string): string {
  return createHmac("sha256", key)
    .update(`${purpose}\u0000${value}`, "utf8")
    .digest("hex");
}

function canonicalRequest(command: CreateIncidentCommand): string {
  const revision = command.revision;
  return JSON.stringify({
    schemaVersion: revision.schemaVersion,
    incidentName: revision.incidentName,
    incidentNumber: revision.incidentNumber,
    occurredAt: revision.occurredAt,
    category: revision.category,
    fieldNotes: revision.fieldNotes,
    reviewedFacts: revision.reviewedFacts,
  });
}

/**
 * Server-only command composition. It does not accept actor/facility IDs from
 * the caller and never returns a Supabase/database error body.
 */
export async function createIncidentForCurrentSession(
  commandCandidate: unknown,
  client: CreateIncidentSessionClient,
  idempotencyHmacKey: string,
): Promise<CreateIncidentResult> {
  const command = createIncidentCommandSchema.safeParse(commandCandidate);
  if (!command.success) return { kind: "denied" };

  const session = await authorizeCurrentSession(client);
  if (!session.allowed) return { kind: "denied" };

  return createIncidentForAuthorizedSession(
    command.data,
    session,
    client,
    idempotencyHmacKey,
  );
}

/**
 * Persists an already-authenticated command using only the facility scope
 * established by the current-session gate. Route handlers use this after
 * validating the same session-bound CSRF token.
 */
export async function createIncidentForAuthorizedSession(
  command: CreateIncidentCommand,
  session: AuthorizedCurrentSession,
  client: IncidentCreateRpcClient,
  idempotencyHmacKey: string,
): Promise<CreateIncidentResult> {
  const revision = command.revision;
  try {
    const result = await client.rpc("create_incident", {
      p_facility_id: session.account.facilityId,
      p_incident_number: revision.incidentNumber,
      p_display_name: revision.incidentName,
      p_occurred_at: revision.occurredAt,
      p_category: revision.category,
      p_schema_version: revision.schemaVersion,
      p_field_notes: revision.fieldNotes,
      p_reviewed_facts: revision.reviewedFacts,
      p_idempotency_key_digest: digest(
        command.idempotencyKey,
        idempotencyHmacKey,
        `${INCIDENT_CREATE_ACTION}.key`,
      ),
      p_request_digest: digest(
        canonicalRequest(command),
        idempotencyHmacKey,
        `${INCIDENT_CREATE_ACTION}.request`,
      ),
    });
    if (result.error || typeof result.data !== "string") {
      return { kind: "unavailable" };
    }

    return { kind: "created", incidentId: result.data };
  } catch {
    return { kind: "unavailable" };
  }
}
