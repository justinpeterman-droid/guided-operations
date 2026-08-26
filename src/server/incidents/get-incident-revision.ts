import "server-only";

import { z } from "zod";

import {
  reviewedFactSchema,
  type ReviewedFact,
} from "@/features/incidents/schema";
import {
  authorizeCurrentSession,
  type CurrentSessionClient,
} from "@/server/auth/current-session";

const revisionReferenceSchema = z.object({
  incidentId: z.uuid(),
  revisionNumber: z.number().int().positive(),
});

const incidentRevisionRowsSchema = z.array(
  z
    .object({
      incident_id: z.uuid(),
      incident_number: z.string().min(1).max(80),
      display_name: z.string().min(1).max(160),
      incident_revision_id: z.uuid(),
      revision_number: z.number().int().positive(),
      schema_version: z.literal(1),
      reviewed_facts: z.array(reviewedFactSchema).max(300),
    })
    .strict(),
);

type IncidentRevisionRpcClient = Readonly<{
  rpc(
    functionName: "get_incident_revision",
    arguments_: Readonly<{
      p_incident_id: string;
      p_revision_number: number;
    }>,
  ): PromiseLike<Readonly<{ data: unknown; error: unknown | null }>>;
}>;

export type GetIncidentRevisionSessionClient = CurrentSessionClient &
  IncidentRevisionRpcClient;

export type AuthorizedIncidentRevision = Readonly<{
  incidentId: string;
  incidentNumber: string;
  displayName: string;
  incidentRevisionId: string;
  revisionNumber: number;
  schemaVersion: 1;
  reviewedFacts: readonly ReviewedFact[];
}>;

export type GetIncidentRevisionResult =
  | Readonly<{ kind: "found"; revision: AuthorizedIncidentRevision }>
  | Readonly<{ kind: "denied" }>
  | Readonly<{ kind: "not_found" }>
  | Readonly<{ kind: "unavailable" }>;

/**
 * Resolves a session before reading one revision through the narrow database
 * API. Unauthorised and absent revisions intentionally share a concealed
 * result, and field notes are never returned to the browser-facing DTO.
 */
export async function getIncidentRevisionForCurrentSession(
  referenceCandidate: unknown,
  client: GetIncidentRevisionSessionClient,
): Promise<GetIncidentRevisionResult> {
  const reference = revisionReferenceSchema.safeParse(referenceCandidate);
  if (!reference.success) return { kind: "not_found" };

  const session = await authorizeCurrentSession(client);
  if (!session.allowed) return { kind: "denied" };

  try {
    const result = await client.rpc("get_incident_revision", {
      p_incident_id: reference.data.incidentId,
      p_revision_number: reference.data.revisionNumber,
    });
    if (result.error) return { kind: "unavailable" };

    const rows = incidentRevisionRowsSchema.safeParse(result.data);
    if (!rows.success) return { kind: "unavailable" };
    if (rows.data.length === 0) return { kind: "not_found" };
    if (rows.data.length !== 1) return { kind: "unavailable" };

    const row = rows.data[0];
    return {
      kind: "found",
      revision: {
        incidentId: row.incident_id,
        incidentNumber: row.incident_number,
        displayName: row.display_name,
        incidentRevisionId: row.incident_revision_id,
        revisionNumber: row.revision_number,
        schemaVersion: row.schema_version,
        reviewedFacts: row.reviewed_facts,
      },
    };
  } catch {
    return { kind: "unavailable" };
  }
}
