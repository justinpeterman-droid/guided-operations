import "server-only";

import { createHmac } from "node:crypto";

import { z } from "zod";

import {
  draftSummaryFields,
  incidentDraftEnvelopeSchema,
  type IncidentDraft,
  type IncidentDraftEnvelope,
  type IncidentDraftSummary,
} from "@/features/incidents/incident-draft";
import type { Json } from "@/lib/supabase/database.generated";
import {
  authorizeCurrentSession,
  type AuthorizedCurrentSession,
  type CurrentSessionClient,
} from "@/server/auth/current-session";

const summaryRowsSchema = z.array(
  z
    .object({
      draft_id: z.uuid(),
      revision_number: z.number().int().positive(),
      incident_number: z.string().nullable(),
      incident_name: z.string().nullable(),
      saved_at: z.iso.datetime({ offset: true }),
    })
    .strict(),
);
const readRowsSchema = z.array(
  z
    .object({
      draft_id: z.uuid(),
      revision_number: z.number().int().positive(),
      incident_number: z.string().nullable(),
      incident_name: z.string().nullable(),
      saved_at: z.iso.datetime({ offset: true }),
      schema_version: z.literal(1),
      payload: z.unknown(),
    })
    .strict(),
);
const saveRowsSchema = z.array(
  z
    .object({
      draft_id: z.uuid(),
      revision_number: z.number().int().positive().nullable(),
      saved_at: z.iso.datetime({ offset: true }).nullable(),
      outcome: z.enum(["saved", "conflict", "denied"]),
    })
    .strict(),
);

type DraftRpcClient = Readonly<{
  rpc(
    functionName: "list_incident_drafts",
    arguments_: { p_limit: number },
  ): PromiseLike<{ data: unknown; error: unknown | null }>;
  rpc(
    functionName: "get_incident_draft",
    arguments_: { p_draft_id: string },
  ): PromiseLike<{ data: unknown; error: unknown | null }>;
  rpc(
    functionName: "save_incident_draft",
    arguments_: {
      p_draft_id: string;
      p_expected_revision: number;
      p_schema_version: number;
      p_payload: Json;
      p_incident_number: string | null;
      p_incident_name: string | null;
      p_request_digest: string;
    },
  ): PromiseLike<{ data: unknown; error: unknown | null }>;
  rpc(
    functionName: "discard_incident_draft",
    arguments_: { p_draft_id: string; p_expected_revision: number },
  ): PromiseLike<{ data: unknown; error: unknown | null }>;
}>;

export type IncidentDraftSessionClient = CurrentSessionClient & DraftRpcClient;

function requestDigest(envelope: IncidentDraftEnvelope, key: string): string {
  return createHmac("sha256", key)
    .update(`incident.draft.save\u0000${JSON.stringify(envelope)}`, "utf8")
    .digest("hex");
}

function toSummary(
  row: z.infer<typeof summaryRowsSchema>[number],
): IncidentDraftSummary {
  return {
    draftId: row.draft_id,
    revisionNumber: row.revision_number,
    incidentNumber: row.incident_number,
    incidentName: row.incident_name,
    savedAt: row.saved_at,
  };
}

export async function listIncidentDraftsForCurrentSession(
  client: IncidentDraftSessionClient,
  limit: number,
): Promise<
  | { kind: "listed"; drafts: readonly IncidentDraftSummary[] }
  | { kind: "denied" | "unavailable" }
> {
  const session = await authorizeCurrentSession(client);
  if (!session.allowed) return { kind: "denied" };
  try {
    const result = await client.rpc("list_incident_drafts", { p_limit: limit });
    const rows = result.error ? null : summaryRowsSchema.safeParse(result.data);
    if (!rows?.success) return { kind: "unavailable" };
    return { kind: "listed", drafts: rows.data.map(toSummary) };
  } catch {
    return { kind: "unavailable" };
  }
}

export async function getIncidentDraftForCurrentSession(
  draftId: string,
  client: IncidentDraftSessionClient,
): Promise<
  | { kind: "found"; draft: IncidentDraft }
  | { kind: "denied" | "unavailable" | "not_found" }
> {
  if (!z.uuid().safeParse(draftId).success) return { kind: "not_found" };
  const session = await authorizeCurrentSession(client);
  if (!session.allowed) return { kind: "denied" };
  try {
    const result = await client.rpc("get_incident_draft", {
      p_draft_id: draftId,
    });
    const rows = result.error ? null : readRowsSchema.safeParse(result.data);
    if (!rows?.success) return { kind: "unavailable" };
    const row = rows.data[0];
    if (!row) return { kind: "not_found" };
    const envelope = incidentDraftEnvelopeSchema.safeParse(row.payload);
    if (!envelope.success) return { kind: "unavailable" };
    return {
      kind: "found",
      draft: { ...toSummary(row), envelope: envelope.data },
    };
  } catch {
    return { kind: "unavailable" };
  }
}

export async function saveIncidentDraftForAuthorizedSession(
  input: Readonly<{
    draftId: string;
    expectedRevision: number;
    envelope: unknown;
  }>,
  _session: AuthorizedCurrentSession,
  client: DraftRpcClient,
  idempotencyHmacKey: string,
): Promise<
  | { kind: "saved"; draft: IncidentDraftSummary }
  | { kind: "conflict" | "denied" | "unavailable" }
> {
  const envelope = incidentDraftEnvelopeSchema.safeParse(input.envelope);
  if (!envelope.success) return { kind: "denied" };
  if (
    !z.uuid().safeParse(input.draftId).success ||
    !z.number().int().nonnegative().safeParse(input.expectedRevision).success
  )
    return { kind: "denied" };
  const summary = draftSummaryFields(envelope.data);
  try {
    const result = await client.rpc("save_incident_draft", {
      p_draft_id: input.draftId,
      p_expected_revision: input.expectedRevision,
      p_schema_version: envelope.data.schemaVersion,
      p_payload: envelope.data as Json,
      p_incident_number: summary.incidentNumber,
      p_incident_name: summary.incidentName,
      p_request_digest: requestDigest(envelope.data, idempotencyHmacKey),
    });
    const rows = result.error ? null : saveRowsSchema.safeParse(result.data);
    if (!rows?.success || rows.data.length !== 1)
      return { kind: "unavailable" };
    const row = rows.data[0];
    if (row.outcome === "conflict") return { kind: "conflict" };
    if (row.outcome !== "saved") return { kind: "denied" };
    if (row.revision_number === null || row.saved_at === null)
      return { kind: "unavailable" };
    return {
      kind: "saved",
      draft: {
        draftId: row.draft_id,
        revisionNumber: row.revision_number,
        incidentNumber: summary.incidentNumber,
        incidentName: summary.incidentName,
        savedAt: row.saved_at,
      },
    };
  } catch {
    return { kind: "unavailable" };
  }
}

export async function discardIncidentDraftForCurrentSession(
  draftId: string,
  expectedRevision: number,
  client: IncidentDraftSessionClient,
) {
  if (
    !z.uuid().safeParse(draftId).success ||
    !z.number().int().positive().safeParse(expectedRevision).success
  )
    return { kind: "denied" as const };
  const session = await authorizeCurrentSession(client);
  if (!session.allowed) return { kind: "denied" as const };
  try {
    const result = await client.rpc("discard_incident_draft", {
      p_draft_id: draftId,
      p_expected_revision: expectedRevision,
    });
    if (result.error) return { kind: "unavailable" as const };
    return result.data === true
      ? { kind: "discarded" as const }
      : { kind: "conflict" as const };
  } catch {
    return { kind: "unavailable" as const };
  }
}
