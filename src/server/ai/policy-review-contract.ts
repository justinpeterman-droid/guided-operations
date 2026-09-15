import { z } from "zod";

const digest = z.string().regex(/^[a-f0-9]{64}$/u);
const page = z
  .object({
    page: z.number().int().min(1).max(1000),
    textSha256: digest,
    evidenceSha256: digest,
  })
  .strict();
const chunk = z
  .object({
    id: z.uuid(),
    ordinal: z.number().int().min(0),
    pageStart: z.number().int().min(1),
    pageEnd: z.number().int().min(1),
    textSha256: digest,
    evidenceSha256: digest,
  })
  .strict();

/** No source text, identities, storage paths, or caller-chosen actor fields. */
export const policyReviewSnapshotSchema = z
  .object({
    protocol: z.literal("policy-full-review-v1"),
    versionId: z.uuid(),
    runId: z.uuid(),
    sourceSha256: digest,
    registrySha256: digest,
    pages: z.array(page).min(1).max(1000),
    chunks: z.array(chunk).min(1).max(2000),
  })
  .strict();

export const policyReviewSchema = policyReviewSnapshotSchema
  .extend({
    reviewId: z.uuid(),
    sourceReviewed: z.literal(true),
    reviewRecordSha256: digest,
    pages: z
      .array(page.extend({ reviewed: z.literal(true) }))
      .min(1)
      .max(1000),
    chunks: z
      .array(chunk.extend({ reviewed: z.literal(true) }))
      .min(1)
      .max(2000),
  })
  .strict();

export type PolicyReview = z.infer<typeof policyReviewSchema>;
