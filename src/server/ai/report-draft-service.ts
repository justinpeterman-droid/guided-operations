import "server-only";

import { z } from "zod";

import {
  GeneratedReportDraftError,
  validateGeneratedReportDraft,
  type GeneratedReportDraft,
} from "@/features/incidents/generated-report-draft";
import type { ReportDraftSource } from "@/features/incidents/report-draft-source";

import type { ReportDraftGenerationProvider } from "./contracts";

const sourceSchema = z.object({
  incidentId: z.uuid(),
  sourceIncidentRevisionId: z.uuid(),
  reportType: z.string().trim().min(1).max(100),
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
  | Readonly<{ kind: "provider_unavailable" }>
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
        const candidate = await generation.generate({ source, ...options });
        return {
          kind: "draft",
          draft: validateGeneratedReportDraft(candidate, source),
        };
      } catch (error) {
        return error instanceof GeneratedReportDraftError ||
          error instanceof z.ZodError
          ? { kind: "invalid_output" }
          : { kind: "provider_unavailable" };
      }
    },
  };
}
