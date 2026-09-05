import "server-only";

import { createHash } from "node:crypto";
import { z } from "zod";

import {
  groundedPolicyAnswerSchema,
  sourceCitationSchema,
  validateGroundedPolicyAnswer,
} from "@/features/policy/grounding";
import type { PolicyAnswerOutcome } from "./policy-answer-service";
import {
  evaluatePolicyAnswerSuite,
  policyEvaluationCaseSchema,
  policyEvaluationSuiteSchema,
  type PolicyAnswerRunner,
} from "./policy-evaluation";

const alias = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{7,159}$/);
const statement = z.string().trim().min(3).max(1200);
const digest = z.string().regex(/^[a-f0-9]{64}$/);

// Parse every runner variant before either qualification lane can accept it.
const evaluationOutcomeSchema = z.discriminatedUnion("kind", [
  z
    .object({ kind: z.literal("answer"), answer: groundedPolicyAnswerSchema })
    .strict(),
  z
    .object({
      kind: z.literal("insufficient_evidence"),
      answer: groundedPolicyAnswerSchema,
    })
    .strict(),
  z
    .object({
      kind: z.literal("provider_unavailable"),
      reasonCode: z.enum([
        "retrieval_failed",
        "generation_failed",
        "invalid_output",
        "budget_check_failed",
        "budget_exhausted",
        "generation_disabled",
      ]),
    })
    .strict(),
]);

export const policyCorrectnessRubricSchema = z
  .object({
    referenceAnswer: z.string().trim().min(3).max(8000),
    referenceSources: z.array(sourceCitationSchema).max(12),
    expectedFacts: z
      .array(
        z
          .object({
            factId: alias,
            statement,
            supportingChunkIds: z.array(z.uuid()).max(12),
          })
          .strict(),
      )
      .min(1)
      .max(20),
    forbiddenClaims: z
      .array(z.object({ claimId: alias, statement }).strict())
      .max(20),
  })
  .strict()
  .superRefine((rubric, context) => {
    const sourceIds = rubric.referenceSources.map((source) => source.chunkId);
    const factIds = rubric.expectedFacts.map((fact) => fact.factId);
    const claimIds = rubric.forbiddenClaims.map((claim) => claim.claimId);
    if (
      [sourceIds, factIds, claimIds].some(
        (ids) => new Set(ids).size !== ids.length,
      )
    ) {
      context.addIssue({
        code: "custom",
        message: "Rubric identifiers must be unique.",
      });
    }
    for (const fact of rubric.expectedFacts) {
      if (
        new Set(fact.supportingChunkIds).size !==
          fact.supportingChunkIds.length ||
        fact.supportingChunkIds.some((id) => !sourceIds.includes(id))
      ) {
        context.addIssue({
          code: "custom",
          message:
            "Expected facts require unique registered reference passages.",
        });
      }
    }
  });

const correctnessCaseSchema = policyEvaluationCaseSchema.safeExtend({
  correctness: policyCorrectnessRubricSchema.nullable(),
});

export const policyCorrectnessSuiteSchema = z
  .object({
    ...policyEvaluationSuiteSchema.shape,
    schemaVersion: z.literal(2),
    rubricVersion: alias,
    rubricReviewReference: alias,
    cases: z.array(correctnessCaseSchema).min(1).max(500),
  })
  .strict()
  .superRefine((suite, context) => {
    if (!policyEvaluationSuiteSchema.safeParse(legacySuite(suite)).success) {
      context.addIssue({
        code: "custom",
        message:
          "The underlying policy evaluation suite is invalid or missing required coverage.",
      });
    }
    for (const item of suite.cases) {
      if (item.expectedStatus === "provider_unavailable") {
        if (item.correctness !== null)
          context.addIssue({
            code: "custom",
            message: "Outage cases must not claim answer correctness.",
          });
        continue;
      }
      const rubric = item.correctness;
      if (!rubric) {
        context.addIssue({
          code: "custom",
          message: "Every content-bearing case requires a correctness rubric.",
        });
        continue;
      }
      if (
        item.expectedStatus !== "insufficient_evidence" &&
        rubric.expectedFacts.some(
          (fact) => fact.supportingChunkIds.length === 0,
        )
      ) {
        context.addIssue({
          code: "custom",
          message:
            "Answered and conflict facts require supporting reference passages.",
        });
      }
      const keys = rubric.referenceSources.map((source) => source.stableKey);
      if (
        keys.some((key) => !item.allowedCitationStableKeys.includes(key)) ||
        item.requiredCitationStableKeys.some((key) => !keys.includes(key))
      ) {
        context.addIssue({
          code: "custom",
          message:
            "Reference passages must agree with the expected citation scope.",
        });
      }
    }
  });

export type PolicyCorrectnessSuite = z.infer<
  typeof policyCorrectnessSuiteSchema
>;

// These are independent review decisions, not fields the answering model supplies.
export const policyCorrectnessReviewSchema = z
  .object({
    packetSha256: digest,
    reviewerReference: alias,
    allAnswerAndLimitationClaimsReviewed: z.literal(true),
    expectedFacts: z
      .array(
        z
          .object({
            factId: alias,
            verdict: z.enum(["supported", "missing", "contradicted"]),
          })
          .strict(),
      )
      .min(1)
      .max(20),
    forbiddenClaims: z
      .array(
        z
          .object({
            claimId: alias,
            present: z.boolean(),
          })
          .strict(),
      )
      .max(20),
    unsupportedClaimCount: z.number().int().min(0).max(200),
  })
  .strict();

export type PolicyCorrectnessReviewPacket = Readonly<{
  packetSha256: string;
  suiteId: string;
  corpusManifestSha256: string;
  corpusManifestVersion: string;
  modelAlias: string;
  retrievalConfigurationAlias: string;
  evaluationConfigurationVersion: string;
  rubricVersion: string;
  rubricReviewReference: string;
  evaluationCase: PolicyCorrectnessSuite["cases"][number];
  outcome: PolicyAnswerOutcome;
}>;

export type PolicyCorrectnessReviewer = Readonly<{
  review(
    packet: PolicyCorrectnessReviewPacket,
    signal: AbortSignal,
  ): Promise<unknown>;
}>;

type CorrectnessResult = Readonly<{
  status:
    | "passed"
    | "failed"
    | "not_reviewed"
    | "invalid_review"
    | "review_unavailable"
    | "invalid_answer"
    | "not_applicable";
  expectedFactCount: number;
  supportedFactCount: number;
  missingFactCount: number;
  contradictedFactCount: number;
  forbiddenClaimCount: number;
  unsupportedClaimCount: number | null;
  reviewEvidenceSha256: string | null;
}>;

function legacySuite(suite: {
  cases: readonly z.infer<typeof correctnessCaseSchema>[];
  [key: string]: unknown;
}) {
  const { rubricVersion, rubricReviewReference, ...base } = suite;
  void rubricVersion;
  void rubricReviewReference;
  return {
    ...base,
    schemaVersion: 1,
    cases: suite.cases.map(({ correctness, ...item }) => {
      void correctness;
      return item;
    }),
  };
}

/** Private packet: never log or include it in the retained scorecard. */
function reviewPacket(
  suite: PolicyCorrectnessSuite,
  evaluationCase: PolicyCorrectnessSuite["cases"][number],
  outcome: PolicyAnswerOutcome,
): PolicyCorrectnessReviewPacket {
  const content = {
    suiteId: suite.suiteId,
    corpusManifestSha256: suite.corpusManifestSha256,
    corpusManifestVersion: suite.corpusManifestVersion,
    modelAlias: suite.modelAlias,
    retrievalConfigurationAlias: suite.retrievalConfigurationAlias,
    evaluationConfigurationVersion: suite.evaluationConfigurationVersion,
    rubricVersion: suite.rubricVersion,
    rubricReviewReference: suite.rubricReviewReference,
    evaluationCase,
    outcome,
  };
  return {
    ...content,
    packetSha256: createHash("sha256")
      .update(JSON.stringify(content))
      .digest("hex"),
  };
}

/** Replay independent private reviews only for the exact answer/rubric/config. */
export function createRecordedPolicyCorrectnessReviewer(
  records: readonly unknown[],
): PolicyCorrectnessReviewer {
  const reviews = z
    .array(policyCorrectnessReviewSchema)
    .max(500)
    .parse(records);
  const byDigest = new Map(
    reviews.map((review) => [review.packetSha256, review]),
  );
  if (byDigest.size !== reviews.length)
    throw new Error("Duplicate correctness review packets.");
  return {
    async review(packet) {
      return byDigest.get(packet.packetSha256);
    },
  };
}

/**
 * V2 requires complete independent correctness review in addition to all V1
 * gates. No reviewer is selected implicitly and this module makes no API calls.
 */
export async function evaluatePolicyCorrectnessSuite(
  runner: PolicyAnswerRunner,
  input: unknown,
  options: {
    reviewer?: PolicyCorrectnessReviewer;
    reviewTimeoutMs?: number;
    clock?: { nowMs: () => number; nowUtc: () => string };
  } = {},
) {
  const suite = policyCorrectnessSuiteSchema.parse(input);
  const timeoutMs = z
    .number()
    .int()
    .min(1)
    .max(60_000)
    .parse(options.reviewTimeoutMs ?? 5000);
  const outcomes: (PolicyAnswerOutcome | undefined)[] = [];
  const baseline = await evaluatePolicyAnswerSuite(
    {
      async answer(request) {
        try {
          const outcome = evaluationOutcomeSchema.parse(
            structuredClone(await runner.answer(request)),
          );
          if (outcome.kind !== "provider_unavailable") {
            const answer = outcome.answer;
            if (
              (outcome.kind === "answer" && answer.status !== "answered") ||
              (outcome.kind === "insufficient_evidence" &&
                answer.status === "answered")
            ) {
              throw new Error("Invalid evaluation outcome.");
            }
          }
          outcomes.push(outcome);
          return outcome;
        } catch {
          outcomes.push(undefined);
          throw new Error("Evaluation runner unavailable.");
        }
      },
    },
    legacySuite(suite),
    options.clock,
  );
  const cases = [];
  for (const [index, item] of suite.cases.entries()) {
    const correctness = await scoreCorrectness(
      suite,
      item,
      outcomes[index],
      options.reviewer,
      timeoutMs,
    );
    const previous = baseline.cases[index];
    cases.push({
      ...previous,
      baselinePassed: previous.passed,
      correctness,
      passed:
        previous.passed &&
        ["passed", "not_applicable"].includes(correctness.status),
    });
  }
  const applicable = cases.filter(
    (item) => item.correctness.status !== "not_applicable",
  );
  const reviewed = applicable.filter((item) =>
    ["passed", "failed"].includes(item.correctness.status),
  );
  const correct = applicable.filter(
    (item) => item.correctness.status === "passed",
  );
  const sum = (key: "expectedFactCount" | "supportedFactCount") =>
    applicable.reduce((total, item) => total + item.correctness[key], 0);
  return {
    ...baseline,
    schemaVersion: 2 as const,
    rubricVersion: suite.rubricVersion,
    rubricReviewReference: suite.rubricReviewReference,
    passedCaseCount: cases.filter((item) => item.passed).length,
    // Baseline metrics remain separately named: citation identity is not meaning.
    baselineMetrics: baseline.metrics,
    baselineThresholdResults: baseline.thresholdResults,
    metrics: {
      overallPassRate:
        cases.filter((item) => item.passed).length / cases.length,
      correctnessReviewCoverage: reviewed.length / applicable.length,
      answerCorrectnessPassRate: correct.length / applicable.length,
      expectedFactCoverage:
        sum("supportedFactCount") / sum("expectedFactCount"),
      unsupportedAnswerRate:
        reviewed.length === 0
          ? null
          : reviewed.filter(
              (item) =>
                (item.correctness.unsupportedClaimCount ?? 0) > 0 ||
                item.correctness.contradictedFactCount > 0 ||
                item.correctness.forbiddenClaimCount > 0,
            ).length / reviewed.length,
    },
    thresholdResults: {
      baseline: baseline.passed,
      correctnessReviewComplete: reviewed.length === applicable.length,
      answerCorrectness: correct.length === applicable.length,
      allCasesPassed: cases.every((item) => item.passed),
    },
    passed: baseline.passed && cases.every((item) => item.passed),
    cases,
  };
}

async function scoreCorrectness(
  suite: PolicyCorrectnessSuite,
  item: PolicyCorrectnessSuite["cases"][number],
  outcome: PolicyAnswerOutcome | undefined,
  reviewer: PolicyCorrectnessReviewer | undefined,
  timeoutMs: number,
): Promise<CorrectnessResult> {
  const empty = {
    expectedFactCount: item.correctness?.expectedFacts.length ?? 0,
    supportedFactCount: 0,
    missingFactCount: 0,
    contradictedFactCount: 0,
    forbiddenClaimCount: 0,
    unsupportedClaimCount: null,
    reviewEvidenceSha256: null,
  };
  if (!item.correctness) return { ...empty, status: "not_applicable" };
  if (!outcome || outcome.kind === "provider_unavailable")
    return { ...empty, status: "invalid_answer" };
  if (outcome.answer.status !== item.expectedStatus)
    return { ...empty, status: "invalid_answer" };
  try {
    // Check immutable source identity independently of the runner's claim.
    validateGroundedPolicyAnswer(
      outcome.answer,
      item.correctness.referenceSources,
    );
  } catch {
    return { ...empty, status: "invalid_answer" };
  }
  if (!reviewer) return { ...empty, status: "not_reviewed" };
  const packet = reviewPacket(suite, item, outcome);
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let raw: unknown;
  try {
    raw = await Promise.race([
      reviewer.review(structuredClone(packet), controller.signal),
      new Promise((_, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(new Error("Review unavailable."));
        }, timeoutMs);
      }),
    ]);
  } catch {
    return { ...empty, status: "review_unavailable" };
  } finally {
    clearTimeout(timer);
  }
  if (raw === undefined) return { ...empty, status: "not_reviewed" };
  const parsed = policyCorrectnessReviewSchema.safeParse(raw);
  if (!parsed.success) return { ...empty, status: "invalid_review" };
  const review = parsed.data;
  if (
    review.packetSha256 !== packet.packetSha256 ||
    !sameIds(
      review.expectedFacts.map((fact) => fact.factId),
      item.correctness.expectedFacts.map((fact) => fact.factId),
    ) ||
    !sameIds(
      review.forbiddenClaims.map((claim) => claim.claimId),
      item.correctness.forbiddenClaims.map((claim) => claim.claimId),
    )
  ) {
    return { ...empty, status: "invalid_review" };
  }
  const cited = new Set(
    outcome.answer.citations.map((source) => source.chunkId),
  );
  const factsWithEvidence = new Set(
    item.correctness.expectedFacts
      .filter((fact) => fact.supportingChunkIds.every((id) => cited.has(id)))
      .map((fact) => fact.factId),
  );
  const supportedFactCount = review.expectedFacts.filter(
    (fact) =>
      fact.verdict === "supported" && factsWithEvidence.has(fact.factId),
  ).length;
  const missingFactCount = review.expectedFacts.filter(
    (fact) =>
      fact.verdict === "missing" ||
      (fact.verdict === "supported" && !factsWithEvidence.has(fact.factId)),
  ).length;
  const contradictedFactCount = review.expectedFacts.filter(
    (fact) => fact.verdict === "contradicted",
  ).length;
  const forbiddenClaimCount = review.forbiddenClaims.filter(
    (claim) => claim.present,
  ).length;
  return {
    ...empty,
    supportedFactCount,
    missingFactCount,
    contradictedFactCount,
    forbiddenClaimCount,
    unsupportedClaimCount: review.unsupportedClaimCount,
    reviewEvidenceSha256: createHash("sha256")
      .update(JSON.stringify(review))
      .digest("hex"),
    status:
      supportedFactCount === empty.expectedFactCount &&
      forbiddenClaimCount === 0 &&
      review.unsupportedClaimCount === 0
        ? "passed"
        : "failed",
  };
}

function sameIds(actual: string[], expected: string[]) {
  return (
    actual.length === expected.length &&
    new Set(actual).size === actual.length &&
    actual.every((id) => expected.includes(id))
  );
}
