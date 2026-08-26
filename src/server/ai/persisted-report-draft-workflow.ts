import "server-only";

import type { ReportDraftRequest } from "@/features/incidents/schema";
import type { GetIncidentRevisionSessionClient } from "@/server/incidents/get-incident-revision";

import type { ReportDraftGenerationProvider } from "./contracts";
import {
  createReportDraftWorkflow,
  type ReportDraftWorkflowOutcome,
} from "./report-draft-workflow";
import {
  storeReportDraftCandidateForCurrentSession,
  type StoreReportDraftCandidateSessionClient,
} from "./store-report-draft-candidate";

export type PersistedReportDraftWorkflowOutcome =
  | Readonly<{ kind: "stored"; candidateId: string }>
  | Exclude<ReportDraftWorkflowOutcome, Readonly<{ kind: "draft" }>>;

/**
 * Generates a review-only candidate from one authorized revision, then stores
 * that exact validated candidate before returning success. It has no browser
 * route; callers must still perform CSRF/origin validation at their boundary.
 */
export function createPersistedReportDraftWorkflow(
  generation: ReportDraftGenerationProvider,
  options: Readonly<{
    maximumParagraphs: number;
    maximumParagraphCharacters: number;
  }>,
) {
  const workflow = createReportDraftWorkflow(generation, options);

  return {
    async draftAndStore(
      request: ReportDraftRequest,
      sourceRevisionNumber: unknown,
      idempotencyKey: string,
      client: GetIncidentRevisionSessionClient &
        StoreReportDraftCandidateSessionClient,
      idempotencyHmacKey: string,
    ): Promise<PersistedReportDraftWorkflowOutcome> {
      const outcome = await workflow.draft(
        request,
        sourceRevisionNumber,
        client,
      );
      if (outcome.kind !== "draft") return outcome;

      return storeReportDraftCandidateForCurrentSession(
        {
          source: outcome.source,
          draft: outcome.draft,
          providerKey: outcome.providerKey,
          idempotencyKey,
        },
        client,
        idempotencyHmacKey,
      );
    },
  };
}
