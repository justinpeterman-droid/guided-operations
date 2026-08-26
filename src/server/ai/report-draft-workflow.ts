import "server-only";

import { z } from "zod";

import {
  buildReportDraftSource,
  ReportDraftSourceError,
} from "@/features/incidents/report-draft-source";
import type { ReportDraftRequest } from "@/features/incidents/schema";
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
  | ReportDraftOutcome
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
        return draftService.draft(source);
      } catch (error) {
        if (
          error instanceof ReportDraftSourceError ||
          error instanceof z.ZodError
        ) {
          return { kind: "not_found" };
        }
        return { kind: "invalid_output" };
      }
    },
  };
}
