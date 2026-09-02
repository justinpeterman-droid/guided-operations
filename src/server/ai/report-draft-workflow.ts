import "server-only";

import { z } from "zod";

import {
  buildReportDraftSource,
  ReportDraftSourceError,
  type ReportDraftSource,
} from "@/features/incidents/report-draft-source";
import type { ReportDraftRequest } from "@/features/incidents/schema";
import type { GeneratedReportDraft } from "@/features/incidents/generated-report-draft";
import {
  getIncidentRevisionForCurrentSession,
  type GetIncidentRevisionSessionClient,
} from "@/server/incidents/get-incident-revision";

import type { ReportDraftGenerationProvider } from "./contracts";
import {
  createReportDraftService,
  type ReportDraftOutcome,
} from "./report-draft-service";

const sourceRevisionNumberSchema = z.number().int().positive();

export type ReportDraftWorkflowOutcome =
  | Readonly<{
      kind: "draft";
      draft: GeneratedReportDraft;
      source: ReportDraftSource;
      providerKey: string;
    }>
  | Exclude<ReportDraftOutcome, Readonly<{ kind: "draft" }>>
  | Readonly<{ kind: "denied" }>
  | Readonly<{ kind: "not_found" }>
  | Readonly<{ kind: "unavailable" }>;

/**
 * Composes the report-draft safety boundary without creating a browser route.
 * It reads the selected immutable revision under the current session, verifies
 * that its opaque revision ID matches the request, then forwards only selected
 * confirmed facts to the generation adapter.
 */
export function createReportDraftWorkflow(
  generation: ReportDraftGenerationProvider,
  options: Readonly<{
    maximumParagraphs: number;
    maximumParagraphCharacters: number;
  }>,
) {
  const draftService = createReportDraftService(generation, options);

  return {
    async draft(
      request: ReportDraftRequest,
      sourceRevisionNumberCandidate: unknown,
      client: GetIncidentRevisionSessionClient,
    ): Promise<ReportDraftWorkflowOutcome> {
      const sourceRevisionNumber = sourceRevisionNumberSchema.safeParse(
        sourceRevisionNumberCandidate,
      );
      if (!sourceRevisionNumber.success) return { kind: "not_found" };

      const revision = await getIncidentRevisionForCurrentSession(
        {
          incidentId: request.incidentId,
          revisionNumber: sourceRevisionNumber.data,
        },
        client,
      );
      if (revision.kind !== "found") return revision;

      try {
        const source = buildReportDraftSource(
          request,
          revision.revision.incidentRevisionId,
          revision.revision.reviewedFacts,
        );
        const outcome = await draftService.draft(source);
        return outcome.kind === "draft"
          ? { ...outcome, source, providerKey: generation.providerKey }
          : outcome;
      } catch (error) {
        if (
          error instanceof ReportDraftSourceError ||
          error instanceof z.ZodError
        ) {
          return { kind: "not_found" };
        }
        return {
          kind: "invalid_output",
          validationFailureCode: "invalid_structure",
        };
      }
    },
  };
}
