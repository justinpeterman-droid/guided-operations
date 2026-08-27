import "server-only";

import { createHmac } from "node:crypto";

import { z } from "zod";

import type { GeneratedReportDraft } from "@/features/incidents/generated-report-draft";
import type { ReportDraftSource } from "@/features/incidents/report-draft-source";
import { reportTypeSchema } from "@/features/incidents/report-types";
import type { Json } from "@/lib/supabase/database.generated";
import {
  authorizeCurrentSession,
  type CurrentSessionClient,
} from "@/server/auth/current-session";

const requestSchema = z.object({
  source: z.object({
    incidentId: z.uuid(),
    sourceIncidentRevisionId: z.uuid(),
    reportType: reportTypeSchema,
    confirmedFacts: z
      .array(z.object({ id: z.uuid() }).passthrough())
      .min(1)
      .max(300),
  }),
  draft: z.object({
    paragraphs: z
      .array(
        z.object({
          text: z.string().trim().min(1).max(4_000),
          sourceFactIds: z.array(z.uuid()).min(1).max(50),
        }),
      )
      .min(1)
      .max(50),
  }),
  providerKey: z.string().regex(/^[a-z][a-z0-9_.-]{2,127}$/),
  idempotencyKey: z.string().regex(/^[A-Za-z0-9_-]{16,128}$/),
});

type StoreReportDraftCandidateRpcClient = Readonly<{
  rpc(
    functionName: "store_report_draft_candidate",
    arguments_: Readonly<{
      p_incident_id: string;
      p_source_incident_revision_id: string;
      p_report_type: string;
      p_source_fact_ids: string[];
      p_paragraphs: Json;
      p_provider_key: string;
      p_idempotency_key_digest: string;
      p_request_digest: string;
    }>,
  ): PromiseLike<Readonly<{ data: unknown; error: unknown | null }>>;
}>;

export type StoreReportDraftCandidateSessionClient = CurrentSessionClient &
  StoreReportDraftCandidateRpcClient;

export type StoreReportDraftCandidateResult =
  | Readonly<{ kind: "stored"; candidateId: string }>
  | Readonly<{ kind: "denied" }>
  | Readonly<{ kind: "unavailable" }>;

function digest(value: string, key: string, purpose: string): string {
  return createHmac("sha256", key)
    .update(`${purpose}\u0000${value}`, "utf8")
    .digest("hex");
}

/** Stores a validated, review-only draft using the authenticated request JWT. */
export async function storeReportDraftCandidateForCurrentSession(
  candidate: Readonly<{
    source: ReportDraftSource;
    draft: GeneratedReportDraft;
    providerKey: string;
    idempotencyKey: string;
  }>,
  client: StoreReportDraftCandidateSessionClient,
  idempotencyHmacKey: string,
): Promise<StoreReportDraftCandidateResult> {
  const parsed = requestSchema.safeParse(candidate);
  if (!parsed.success) return { kind: "denied" };

  const session = await authorizeCurrentSession(client);
  if (!session.allowed) return { kind: "denied" };

  const sourceFactIds = parsed.data.source.confirmedFacts.map(
    (fact) => fact.id,
  );
  const canonicalRequest = JSON.stringify({
    incidentId: parsed.data.source.incidentId,
    sourceIncidentRevisionId: parsed.data.source.sourceIncidentRevisionId,
    reportType: parsed.data.source.reportType,
    sourceFactIds,
    paragraphs: parsed.data.draft.paragraphs,
    providerKey: parsed.data.providerKey,
  });

  try {
    const result = await client.rpc("store_report_draft_candidate", {
      p_incident_id: parsed.data.source.incidentId,
      p_source_incident_revision_id:
        parsed.data.source.sourceIncidentRevisionId,
      p_report_type: parsed.data.source.reportType,
      p_source_fact_ids: sourceFactIds,
      p_paragraphs: parsed.data.draft.paragraphs,
      p_provider_key: parsed.data.providerKey,
      p_idempotency_key_digest: digest(
        parsed.data.idempotencyKey,
        idempotencyHmacKey,
        "report.draft.store.key",
      ),
      p_request_digest: digest(
        canonicalRequest,
        idempotencyHmacKey,
        "report.draft.store.request",
      ),
    });
    return !result.error && typeof result.data === "string"
      ? { kind: "stored", candidateId: result.data }
      : { kind: "unavailable" };
  } catch {
    return { kind: "unavailable" };
  }
}
