import "server-only";

import { z } from "zod";

import {
  GeneratedReportDraftError,
  validateGeneratedReportDraft,
  type GeneratedReportDraft,
} from "@/features/incidents/generated-report-draft";
import type { ReportDraftSource } from "@/features/incidents/report-draft-source";
import { reportTypeSchema } from "@/features/incidents/report-types";

import type { ReportDraftGenerationProvider } from "./contracts";
import { AiBudgetCircuitOpenError } from "./ai-request-budget";

const sourceSchema = z.object({
  incidentId: z.uuid(),
  sourceIncidentRevisionId: z.uuid(),
  reportingStaffMemberId: z.uuid(),
  reportType: reportTypeSchema,
  confirmedFacts: z
    .array(
      z.object({
        id: z.uuid(),
        field: z.string().trim().min(1).max(120),
        value: z.string().trim().min(1).max(8_000),
        sourceNoteIds: z.array(z.uuid()).min(1).max(100),
      }),
    )
    .min(1)
    .max(300),
});

export type ReportDraftOutcome =
  | Readonly<{ kind: "draft"; draft: GeneratedReportDraft }>
  | Readonly<{
      kind: "provider_unavailable";
      reasonCode:
        | "generation_failed"
        | "budget_check_failed"
        | "budget_exhausted"
        | "generation_disabled";
    }>
  | Readonly<{ kind: "invalid_output" }>;

/**
 * Generates a review-only candidate from a single immutable, confirmed-fact
 * source. No raw notes, unknown facts, identity fields, or provider output are
 * retained by this service.
 */
export function createReportDraftService(
  generation: ReportDraftGenerationProvider,
  options: Readonly<{
    maximumParagraphs: number;
    maximumParagraphCharacters: number;
  }>,
) {
  if (options.maximumParagraphs < 1 || options.maximumParagraphs > 50) {
    throw new Error("Report drafts require between 1 and 50 paragraphs.");
  }
  if (
    options.maximumParagraphCharacters < 1 ||
    options.maximumParagraphCharacters > 4_000
  ) {
    throw new Error("Report draft paragraphs require a bounded length.");
  }

  return {
    async draft(
      sourceCandidate: ReportDraftSource,
    ): Promise<ReportDraftOutcome> {
      const source = sourceSchema.parse(sourceCandidate);
      try {
        const providerSource = {
          incidentId: source.incidentId,
          sourceIncidentRevisionId: source.sourceIncidentRevisionId,
          reportType: source.reportType,
          confirmedFacts: source.confirmedFacts,
        };
        const candidate = await generation.generate({
          source: providerSource,
          ...options,
        });
        return {
          kind: "draft",
          draft: validateGeneratedReportDraft(candidate, source),
        };
      } catch (error) {
        if (error instanceof AiBudgetCircuitOpenError) {
          return {
            kind: "provider_unavailable",
            reasonCode: error.reasonCode,
          };
        }
        return error instanceof GeneratedReportDraftError ||
          error instanceof z.ZodError
          ? { kind: "invalid_output" }
          : { kind: "provider_unavailable", reasonCode: "generation_failed" };
      }
    },
  };
}
