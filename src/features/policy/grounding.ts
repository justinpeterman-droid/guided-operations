import { z } from "zod";

const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);

export const sourceCitationSchema = z
  .object({
    documentId: z.uuid(),
    documentVersionId: z.uuid(),
    chunkId: z.uuid(),
    stableKey: z.string().min(2).max(128),
    title: z.string().min(1).max(300),
    versionLabel: z.string().min(1).max(120),
    sourceSha256: sha256Schema,
    pageStart: z.number().int().positive().nullable(),
    pageEnd: z.number().int().positive().nullable(),
    sectionPath: z.string().min(1).max(300).nullable(),
    excerpt: z.string().min(1).max(1200),
  })
  .strict()
  .superRefine((citation, context) => {
    if (
      citation.pageStart !== null &&
      citation.pageEnd !== null &&
      citation.pageEnd < citation.pageStart
    ) {
      context.addIssue({
        code: "custom",
        message: "Citation page end cannot precede page start.",
        path: ["pageEnd"],
      });
    }

    if (
      citation.pageStart === null &&
      citation.pageEnd === null &&
      citation.sectionPath === null
    ) {
      context.addIssue({
        code: "custom",
        message: "A citation needs a page range or section path.",
        path: ["sectionPath"],
      });
    }
  });

export const groundedPolicyAnswerSchema = z
  .object({
    status: z.enum([
      "answered",
      "insufficient_evidence",
      "conflicting_sources",
    ]),
    answer: z.string().min(1).max(8000),
    citations: z.array(sourceCitationSchema).max(12),
    limitations: z.array(z.string().min(1).max(500)).max(12),
  })
  .strict()
  .superRefine((answer, context) => {
    if (answer.status === "answered" && answer.citations.length === 0) {
      context.addIssue({
        code: "custom",
        message: "An authoritative answer requires at least one citation.",
        path: ["citations"],
      });
    }

    if (answer.status !== "answered" && answer.limitations.length === 0) {
      context.addIssue({
        code: "custom",
        message: "A limited answer must explain its limitation.",
        path: ["limitations"],
      });
    }
  });

export type SourceCitation = z.infer<typeof sourceCitationSchema>;
export type GroundedPolicyAnswer = z.infer<typeof groundedPolicyAnswerSchema>;

export class GroundedPolicyAnswerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GroundedPolicyAnswerError";
  }
}

/**
 * Enforces that a provider can cite only the exact immutable passages supplied
 * to it. The caller may persist/display the validated answer but must never
 * substitute a model-invented source, page range, or excerpt.
 */
export function validateGroundedPolicyAnswer(
  candidate: unknown,
  retrievedCitations: readonly SourceCitation[],
): GroundedPolicyAnswer {
  const parsed = groundedPolicyAnswerSchema.parse(candidate);
  const retrievedByChunkId = new Map(
    retrievedCitations.map((citation) => [citation.chunkId, citation]),
  );

  for (const citation of parsed.citations) {
    const retrieved = retrievedByChunkId.get(citation.chunkId);
    if (!retrieved) {
      throw new GroundedPolicyAnswerError(
        "A policy answer cited a passage outside the retrieved evidence.",
      );
    }

    if (
      citation.documentId !== retrieved.documentId ||
      citation.documentVersionId !== retrieved.documentVersionId ||
      citation.stableKey !== retrieved.stableKey ||
      citation.title !== retrieved.title ||
      citation.versionLabel !== retrieved.versionLabel ||
      citation.sourceSha256 !== retrieved.sourceSha256 ||
      citation.pageStart !== retrieved.pageStart ||
      citation.pageEnd !== retrieved.pageEnd ||
      citation.sectionPath !== retrieved.sectionPath ||
      citation.excerpt !== retrieved.excerpt
    ) {
      throw new GroundedPolicyAnswerError(
        "A policy answer altered the provenance of a retrieved citation.",
      );
    }
  }

  return parsed;
}
