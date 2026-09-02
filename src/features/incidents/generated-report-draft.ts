import { z } from "zod";

import type { ReportDraftSource } from "./report-draft-source";
import {
  findBlockingReportWritingRule,
  type ReportWritingRuleId,
} from "./report-writing-rules";

const opaqueIdSchema = z.uuid();

export const generatedReportDraftSchema = z
  .object({
    paragraphs: z
      .array(
        z
          .object({
            text: z.string().trim().min(1).max(4_000),
            sourceFactIds: z.array(opaqueIdSchema).min(1).max(50),
          })
          .strict(),
      )
      .min(1)
      .max(50),
  })
  .strict();

export type GeneratedReportDraft = z.infer<typeof generatedReportDraftSchema>;

export type ReportDraftValidationFailureCode =
  | ReportWritingRuleId
  | "duplicate_source_fact"
  | "unknown_source_fact"
  | "invalid_structure";

export class GeneratedReportDraftError extends Error {
  readonly reasonCode: ReportDraftValidationFailureCode;

  constructor(message: string, reasonCode: ReportDraftValidationFailureCode) {
    super(message);
    this.name = "GeneratedReportDraftError";
    this.reasonCode = reasonCode;
  }
}

/**
 * Validates a provider candidate against the immutable confirmed-fact source.
 * It cannot prove prose quality; the resulting candidate remains an explicitly
 * unreviewed draft for an officer to inspect before it becomes a report revision.
 */
export function validateGeneratedReportDraft(
  candidate: unknown,
  source: ReportDraftSource,
): GeneratedReportDraft {
  const parsed = generatedReportDraftSchema.parse(candidate);
  const allowedFactIds = new Set(source.confirmedFacts.map((fact) => fact.id));

  for (const [paragraphIndex, paragraph] of parsed.paragraphs.entries()) {
    const uniqueFactIds = new Set(paragraph.sourceFactIds);
    if (uniqueFactIds.size !== paragraph.sourceFactIds.length) {
      throw new GeneratedReportDraftError(
        `Paragraph ${paragraphIndex + 1} repeats a source fact reference.`,
        "duplicate_source_fact",
      );
    }

    for (const factId of paragraph.sourceFactIds) {
      if (!allowedFactIds.has(factId)) {
        throw new GeneratedReportDraftError(
          "A generated report draft referenced a fact outside its confirmed source.",
          "unknown_source_fact",
        );
      }
    }
  }

  const blockingRule = findBlockingReportWritingRule(parsed, source);
  if (blockingRule) {
    throw new GeneratedReportDraftError(
      `Generated report draft failed ${blockingRule}.`,
      blockingRule,
    );
  }

  return parsed;
}
