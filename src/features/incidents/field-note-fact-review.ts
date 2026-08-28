import { z } from "zod";

const nonEmptyText = (maximum: number) => z.string().trim().min(1).max(maximum);
const proposalKeySchema = z.string().regex(/^field-note-line-[1-9][0-9]{0,3}$/);

export const fieldNoteFactReviewSchema = z
  .object({
    key: proposalKeySchema,
    sourceText: nonEmptyText(8_000),
    value: nonEmptyText(8_000),
    decision: z.enum(["confirmed", "excluded"]),
  })
  .strict();

export type FieldNoteFactReview = z.infer<typeof fieldNoteFactReviewSchema>;

export type FieldNoteFactProposal = Readonly<{
  key: string;
  sourceText: string;
  value: string;
}>;

/**
 * Builds a deliberately conservative review list. One non-empty officer note
 * line becomes one proposal; this function does not infer or rewrite facts.
 */
export function proposeFactsFromFieldNotes(
  notes: string,
): readonly FieldNoteFactProposal[] {
  return notes
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((sourceText, index) => ({
      key: `field-note-line-${index + 1}`,
      sourceText,
      value: sourceText,
    }));
}

export function buildReviewedFieldNoteFacts(
  input: Readonly<{
    reviews: readonly unknown[];
    sourceNoteId: string;
    recordedAt: string;
    idFactory: () => string;
    reportingStaffMemberIdsByProposalKey: Readonly<
      Record<string, readonly string[]>
    >;
  }>,
): Readonly<{
  reviewNotes: readonly Readonly<{
    id: string;
    text: string;
    recordedAt: string;
  }>[];
  reviewedFacts: readonly Readonly<{
    id: string;
    field: string;
    state: "confirmed";
    value: string;
    sourceNoteIds: readonly string[];
    reportingStaffMemberIds: readonly string[];
  }>[];
}> {
  const reviews = z
    .array(fieldNoteFactReviewSchema)
    .min(1)
    .max(200)
    .superRefine((items, context) => {
      const keys = items.map(({ key }) => key);
      if (new Set(keys).size !== keys.length) {
        context.addIssue({
          code: "custom",
          message: "Review keys must be unique.",
        });
      }
    })
    .parse(input.reviews);

  const reviewNotes: Array<{
    id: string;
    text: string;
    recordedAt: string;
  }> = [];
  const reviewedFacts: Array<{
    id: string;
    field: string;
    state: "confirmed";
    value: string;
    sourceNoteIds: string[];
    reportingStaffMemberIds: string[];
  }> = [];

  for (const review of reviews) {
    if (review.decision === "excluded") continue;
    const reportingStaffMemberIds = [
      ...(input.reportingStaffMemberIdsByProposalKey[review.key] ?? []),
    ];
    if (!reportingStaffMemberIds.length) {
      throw new Error("A confirmed fact requires a reporting officer scope.");
    }

    let sourceNoteId = input.sourceNoteId;
    if (review.value !== review.sourceText) {
      sourceNoteId = input.idFactory();
      reviewNotes.push({
        id: sourceNoteId,
        text: `Officer-reviewed fact based on ${review.key}\n${review.value}`,
        recordedAt: input.recordedAt,
      });
    }
    reviewedFacts.push({
      id: input.idFactory(),
      field: `Officer-confirmed fact ${review.key.replace("field-note-line-", "")}`,
      state: "confirmed",
      value: review.value,
      sourceNoteIds: [sourceNoteId],
      reportingStaffMemberIds,
    });
  }

  return { reviewNotes, reviewedFacts };
}
