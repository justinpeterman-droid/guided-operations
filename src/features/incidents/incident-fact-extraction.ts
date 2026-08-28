import { z } from "zod";

import {
  REPORT_CHECKLIST_CATEGORIES,
  getReportChecklistCategory,
  type ReportChecklistCategoryKey,
} from "./report-assistant-checklist";
import {
  isSupportedFactProposalSet,
  proposeFactsFromFieldNotes,
  type FieldNoteFactProposal,
} from "./field-note-fact-review";

const providerCandidateSchema = z
  .object({
    categoryKey: z.string().trim().min(1).max(80),
    facts: z
      .array(
        z
          .object({
            sourceLineKey: z
              .string()
              .regex(/^field-note-line-[1-9][0-9]{0,3}$/),
            value: z.string().trim().min(1).max(8_000),
          })
          .strict(),
      )
      .min(1)
      .max(200),
  })
  .strict();

export const incidentFactExtractionResultSchema = z
  .object({
    categoryKey: z.string().trim().min(1).max(80),
    proposals: z
      .array(
        z
          .object({
            key: z
              .string()
              .regex(/^field-note-line-[1-9][0-9]{0,3}-fact-[1-9][0-9]{0,2}$/),
            sourceText: z.string().trim().min(1).max(8_000),
            value: z.string().trim().min(1).max(8_000),
          })
          .strict(),
      )
      .min(1)
      .max(200),
  })
  .strict();

export type IncidentFactExtractionResult = z.infer<
  typeof incidentFactExtractionResultSchema
>;

export type IncidentFactExtractionRequest = Readonly<{
  sourceLines: readonly Readonly<{ key: string; text: string }>[];
  categories: readonly Readonly<{ key: string; label: string }>[];
  maximumFacts: number;
}>;

export class IncidentFactExtractionError extends Error {
  constructor(readonly code: "invalid_source" | "invalid_output") {
    super("Incident fact extraction could not be validated.");
    this.name = "IncidentFactExtractionError";
  }
}

export function buildIncidentFactExtractionRequest(
  notes: string,
): IncidentFactExtractionRequest {
  const proposals = proposeFactsFromFieldNotes(notes);
  if (!isSupportedFactProposalSet(proposals)) {
    throw new IncidentFactExtractionError("invalid_source");
  }
  return {
    sourceLines: proposals.map(({ key, sourceText }) => ({
      key,
      text: sourceText,
    })),
    categories: REPORT_CHECKLIST_CATEGORIES.map(({ key, label }) => ({
      key,
      label,
    })),
    maximumFacts: 200,
  };
}

/**
 * Converts untrusted provider output into review-only proposals. The provider
 * may reference a source line key, but only this function can restore the exact
 * officer-entered source text shown during review.
 */
export function validateIncidentFactExtraction(
  candidate: unknown,
  request: IncidentFactExtractionRequest,
): IncidentFactExtractionResult {
  const parsed = providerCandidateSchema.safeParse(candidate);
  const category = parsed.success
    ? getReportChecklistCategory(parsed.data.categoryKey)
    : undefined;
  if (!parsed.success || !category) {
    throw new IncidentFactExtractionError("invalid_output");
  }

  const sourceTextByKey = new Map(
    request.sourceLines.map(({ key, text }) => [key, text]),
  );
  const occurrenceByLine = new Map<string, number>();
  const proposals: FieldNoteFactProposal[] = parsed.data.facts.map((fact) => {
    const sourceText = sourceTextByKey.get(fact.sourceLineKey);
    if (!sourceText) {
      throw new IncidentFactExtractionError("invalid_output");
    }
    const occurrence = (occurrenceByLine.get(fact.sourceLineKey) ?? 0) + 1;
    occurrenceByLine.set(fact.sourceLineKey, occurrence);
    return {
      key: `${fact.sourceLineKey}-fact-${occurrence}`,
      sourceText,
      value: fact.value,
    };
  });
  if (!isSupportedFactProposalSet(proposals)) {
    throw new IncidentFactExtractionError("invalid_output");
  }

  return incidentFactExtractionResultSchema.parse({
    categoryKey: category.key as ReportChecklistCategoryKey,
    proposals,
  });
}
