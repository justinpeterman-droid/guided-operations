import "server-only";

import { z } from "zod";

import type {
  PolicyAnswerOutcome,
  PolicyAnswerRequest,
} from "./policy-answer-service";

const aliasSchema = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{7,159}$/);
const stableKeySchema = z.string().min(2).max(128);
const utcSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/)
  .refine((value) => Number.isFinite(Date.parse(value)), "Invalid UTC time");

const requiredPolicyEvaluationCategories = [
  "exact_retrieval",
  "semantic_retrieval",
  "version_disambiguation",
  "citation_fidelity",
  "conflicting_sources",
  "abstention",
  "prompt_injection",
  "access_boundary",
  "provider_degradation",
] as const;

export const policyEvaluationCategorySchema = z.enum(
  requiredPolicyEvaluationCategories,
);

export const policyEvaluationCaseSchema = z
  .object({
    caseId: aliasSchema,
    categories: z.array(policyEvaluationCategorySchema).min(1).max(9),
    request: z
      .object({
        facilityId: z.uuid(),
        question: z.string().trim().min(3).max(2_000),
        approvedDocumentVersionIds: z.array(z.uuid()).max(50).optional(),
      })
      .strict(),
    expectedStatus: z.enum([
      "answered",
      "insufficient_evidence",
      "conflicting_sources",
      "provider_unavailable",
    ]),
    requiredCitationStableKeys: z.array(stableKeySchema).max(12),
    allowedCitationStableKeys: z.array(stableKeySchema).max(24),
    forbiddenAnswerFragments: z
      .array(z.string().trim().min(3).max(200))
      .max(20),
    maximumLatencyMs: z.number().int().positive().max(120_000),
  })
  .strict()
  .superRefine((value, context) => {
    requireUnique(value.categories, ["categories"], context);
    requireUnique(
      value.requiredCitationStableKeys,
      ["requiredCitationStableKeys"],
      context,
    );
    requireUnique(
      value.allowedCitationStableKeys,
      ["allowedCitationStableKeys"],
      context,
    );

    const allowed = new Set(value.allowedCitationStableKeys);
    for (const key of value.requiredCitationStableKeys) {
      if (!allowed.has(key)) {
        context.addIssue({
          code: "custom",
          path: ["allowedCitationStableKeys"],
          message: "Every required citation must also be allowed.",
        });
      }
    }

    if (
      value.expectedStatus === "answered" &&
      value.requiredCitationStableKeys.length === 0
    ) {
      context.addIssue({
        code: "custom",
        path: ["requiredCitationStableKeys"],
        message: "An answered evaluation requires expected citation evidence.",
      });
    }

    if (
      value.expectedStatus === "conflicting_sources" &&
      value.requiredCitationStableKeys.length < 2
    ) {
      context.addIssue({
        code: "custom",
        path: ["requiredCitationStableKeys"],
        message: "A conflict evaluation requires both expected sources.",
      });
    }

    if (
      new Set(["insufficient_evidence", "provider_unavailable"]).has(
        value.expectedStatus,
      ) &&
      value.requiredCitationStableKeys.length > 0
    ) {
      context.addIssue({
        code: "custom",
        path: ["requiredCitationStableKeys"],
        message: "A refusal or outage evaluation cannot require citations.",
      });
    }

    if (
      value.categories.includes("prompt_injection") &&
      value.forbiddenAnswerFragments.length === 0
    ) {
      context.addIssue({
        code: "custom",
        path: ["forbiddenAnswerFragments"],
        message: "A prompt-injection case requires a forbidden output marker.",
      });
    }

    requireCategoryStatus(
      value,
      [
        "exact_retrieval",
        "semantic_retrieval",
        "version_disambiguation",
        "citation_fidelity",
      ],
      "answered",
      context,
    );
    requireCategoryStatus(
      value,
      ["conflicting_sources"],
      "conflicting_sources",
      context,
    );
    requireCategoryStatus(
      value,
      ["abstention", "access_boundary"],
      "insufficient_evidence",
      context,
    );
    requireCategoryStatus(
      value,
      ["provider_degradation"],
      "provider_unavailable",
      context,
    );

    if (
      value.categories.includes("prompt_injection") &&
      value.expectedStatus === "provider_unavailable"
    ) {
      context.addIssue({
        code: "custom",
        path: ["expectedStatus"],
        message:
          "A prompt-injection case must exercise an answer or evidence response.",
      });
    }
  });

export const policyEvaluationThresholdsSchema = z
  .object({
    minimumOverallPassRate: z.number().min(0).max(1),
    minimumCitationRecall: z.number().min(0).max(1),
    minimumCitationPrecision: z.number().min(0).max(1),
    minimumAbstentionPassRate: z.number().min(0).max(1),
    minimumInjectionPassRate: z.number().min(0).max(1),
    maximumP95LatencyMs: z.number().int().positive().max(120_000),
  })
  .strict();

export const policyEvaluationSuiteSchema = z
  .object({
    schemaVersion: z.literal(1),
    suiteId: aliasSchema,
    corpusManifestVersion: aliasSchema,
    corpusManifestSha256: z.string().regex(/^[a-f0-9]{64}$/),
    modelAlias: aliasSchema,
    retrievalConfigurationAlias: aliasSchema,
    evaluationConfigurationVersion: aliasSchema,
    thresholds: policyEvaluationThresholdsSchema,
    cases: z.array(policyEvaluationCaseSchema).min(1).max(500),
  })
  .strict()
  .superRefine((suite, context) => {
    requireUnique(
      suite.cases.map((item) => item.caseId),
      ["cases"],
      context,
    );
    for (const requiredCategory of requiredPolicyEvaluationCategories) {
      if (
        !suite.cases.some((item) => item.categories.includes(requiredCategory))
      ) {
        context.addIssue({
          code: "custom",
          path: ["cases"],
          message: `The suite requires at least one ${requiredCategory} case.`,
        });
      }
    }
  });

export type PolicyEvaluationCase = z.infer<typeof policyEvaluationCaseSchema>;
export type PolicyEvaluationSuite = z.infer<typeof policyEvaluationSuiteSchema>;

export type PolicyEvaluationCaseResult = Readonly<{
  caseId: string;
  categories: readonly z.infer<typeof policyEvaluationCategorySchema>[];
  observedStatus:
    | "answered"
    | "insufficient_evidence"
    | "conflicting_sources"
    | "provider_unavailable"
    | "runner_error";
  statusMatches: boolean;
  citationExpected: boolean;
  requiredCitationRecall: number;
  citationPrecision: number;
  forbiddenAnswerFragmentDetected: boolean;
  latencyMs: number;
  latencyWithinBudget: boolean;
  passed: boolean;
}>;

export type PolicyEvaluationScorecard = Readonly<{
  schemaVersion: 1;
  suiteId: string;
  corpusManifestVersion: string;
  corpusManifestSha256: string;
  modelAlias: string;
  retrievalConfigurationAlias: string;
  evaluationConfigurationVersion: string;
  evaluatedAtUtc: string;
  caseCount: number;
  passedCaseCount: number;
  metrics: Readonly<{
    overallPassRate: number;
    citationRecall: number;
    citationPrecision: number;
    abstentionPassRate: number;
    injectionPassRate: number;
    p95LatencyMs: number;
  }>;
  thresholdResults: Readonly<{
    overallPassRate: boolean;
    citationRecall: boolean;
    citationPrecision: boolean;
    abstentionPassRate: boolean;
    injectionPassRate: boolean;
    p95Latency: boolean;
  }>;
  passed: boolean;
  cases: readonly PolicyEvaluationCaseResult[];
}>;

export type PolicyAnswerRunner = Readonly<{
  answer(request: PolicyAnswerRequest): Promise<PolicyAnswerOutcome>;
}>;

/**
 * Runs a private evaluation suite sequentially. The returned scorecard contains
 * no question, answer, excerpt, person, or operational content; retain the
 * private suite separately under the corpus access boundary.
 */
export async function evaluatePolicyAnswerSuite(
  runner: PolicyAnswerRunner,
  input: unknown,
  clock: Readonly<{
    nowMs: () => number;
    nowUtc: () => string;
  }> = {
    nowMs: () => performance.now(),
    nowUtc: () => new Date().toISOString(),
  },
): Promise<PolicyEvaluationScorecard> {
  const suite = policyEvaluationSuiteSchema.parse(input);
  const caseResults: PolicyEvaluationCaseResult[] = [];

  for (const evaluationCase of suite.cases) {
    const startedAt = clock.nowMs();
    let outcome: PolicyAnswerOutcome | undefined;
    try {
      outcome = await runner.answer(evaluationCase.request);
    } catch {
      outcome = undefined;
    }
    const latencyMs = Math.max(0, Math.round(clock.nowMs() - startedAt));
    caseResults.push(scoreCase(evaluationCase, outcome, latencyMs));
  }

  const metrics = calculateMetrics(caseResults);
  const thresholdResults = {
    overallPassRate:
      metrics.overallPassRate >= suite.thresholds.minimumOverallPassRate,
    citationRecall:
      metrics.citationRecall >= suite.thresholds.minimumCitationRecall,
    citationPrecision:
      metrics.citationPrecision >= suite.thresholds.minimumCitationPrecision,
    abstentionPassRate:
      metrics.abstentionPassRate >= suite.thresholds.minimumAbstentionPassRate,
    injectionPassRate:
      metrics.injectionPassRate >= suite.thresholds.minimumInjectionPassRate,
    p95Latency: metrics.p95LatencyMs <= suite.thresholds.maximumP95LatencyMs,
  };

  const evaluatedAtUtc = utcSchema.parse(clock.nowUtc());
  return {
    schemaVersion: 1,
    suiteId: suite.suiteId,
    corpusManifestVersion: suite.corpusManifestVersion,
    corpusManifestSha256: suite.corpusManifestSha256,
    modelAlias: suite.modelAlias,
    retrievalConfigurationAlias: suite.retrievalConfigurationAlias,
    evaluationConfigurationVersion: suite.evaluationConfigurationVersion,
    evaluatedAtUtc,
    caseCount: caseResults.length,
    passedCaseCount: caseResults.filter((item) => item.passed).length,
    metrics,
    thresholdResults,
    passed: Object.values(thresholdResults).every(Boolean),
    cases: caseResults,
  };
}

function scoreCase(
  evaluationCase: PolicyEvaluationCase,
  outcome: PolicyAnswerOutcome | undefined,
  latencyMs: number,
): PolicyEvaluationCaseResult {
  const observedStatus = getObservedStatus(outcome);
  const citations =
    outcome && outcome.kind !== "provider_unavailable"
      ? outcome.answer.citations.map((citation) => citation.stableKey)
      : [];
  const userVisibleAnswerParts =
    outcome && outcome.kind !== "provider_unavailable"
      ? [outcome.answer.answer, ...outcome.answer.limitations].map((part) =>
          part.toLocaleLowerCase("en-US"),
        )
      : [];
  const required = new Set(evaluationCase.requiredCitationStableKeys);
  const allowed = new Set(evaluationCase.allowedCitationStableKeys);
  const observed = new Set(citations);
  const requiredCitationRecall =
    required.size === 0
      ? 1
      : [...required].filter((key) => observed.has(key)).length / required.size;
  const citationPrecision =
    observed.size === 0
      ? required.size === 0
        ? 1
        : 0
      : [...observed].filter((key) => allowed.has(key)).length / observed.size;
  const forbiddenAnswerFragmentDetected =
    evaluationCase.forbiddenAnswerFragments.some((fragment) =>
      userVisibleAnswerParts.some((part) =>
        part.includes(fragment.toLocaleLowerCase("en-US")),
      ),
    );
  const statusMatches = observedStatus === evaluationCase.expectedStatus;
  const latencyWithinBudget = latencyMs <= evaluationCase.maximumLatencyMs;
  const passed =
    statusMatches &&
    requiredCitationRecall === 1 &&
    citationPrecision === 1 &&
    !forbiddenAnswerFragmentDetected &&
    latencyWithinBudget;

  return {
    caseId: evaluationCase.caseId,
    categories: evaluationCase.categories,
    observedStatus,
    statusMatches,
    citationExpected: required.size > 0,
    requiredCitationRecall,
    citationPrecision,
    forbiddenAnswerFragmentDetected,
    latencyMs,
    latencyWithinBudget,
    passed,
  };
}

function requireCategoryStatus(
  value: {
    categories: readonly z.infer<typeof policyEvaluationCategorySchema>[];
    expectedStatus:
      | "answered"
      | "insufficient_evidence"
      | "conflicting_sources"
      | "provider_unavailable";
  },
  categories: readonly z.infer<typeof policyEvaluationCategorySchema>[],
  expectedStatus:
    | "answered"
    | "insufficient_evidence"
    | "conflicting_sources"
    | "provider_unavailable",
  context: z.RefinementCtx,
) {
  const matchingCategory = categories.find((category) =>
    value.categories.includes(category),
  );
  if (matchingCategory && value.expectedStatus !== expectedStatus) {
    context.addIssue({
      code: "custom",
      path: ["expectedStatus"],
      message: `${matchingCategory} cases require ${expectedStatus}.`,
    });
  }
}

function getObservedStatus(
  outcome: PolicyAnswerOutcome | undefined,
): PolicyEvaluationCaseResult["observedStatus"] {
  if (!outcome) return "runner_error";
  if (outcome.kind === "provider_unavailable") return "provider_unavailable";
  return outcome.answer.status;
}

function calculateMetrics(cases: readonly PolicyEvaluationCaseResult[]) {
  const citationCases = cases.filter((item) => item.citationExpected);
  const abstentionCases = cases.filter((item) =>
    item.categories.includes("abstention"),
  );
  const injectionCases = cases.filter((item) =>
    item.categories.includes("prompt_injection"),
  );
  return {
    overallPassRate: passRate(cases),
    citationRecall: average(
      citationCases.map((item) => item.requiredCitationRecall),
    ),
    citationPrecision: average(
      citationCases.map((item) => item.citationPrecision),
    ),
    abstentionPassRate: passRate(abstentionCases),
    injectionPassRate: passRate(injectionCases),
    p95LatencyMs: percentile95(cases.map((item) => item.latencyMs)),
  };
}

function passRate(items: readonly PolicyEvaluationCaseResult[]) {
  if (items.length === 0) return 0;
  return items.filter((item) => item.passed).length / items.length;
}

function average(values: readonly number[]) {
  if (values.length === 0) return 0;
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function percentile95(values: readonly number[]) {
  if (values.length === 0) return 0;
  const ordered = [...values].sort((left, right) => left - right);
  return ordered[Math.max(0, Math.ceil(ordered.length * 0.95) - 1)];
}

function requireUnique(
  values: readonly string[],
  path: PropertyKey[],
  context: z.RefinementCtx,
) {
  if (new Set(values).size !== values.length) {
    context.addIssue({
      code: "custom",
      path,
      message: "Values must be unique.",
    });
  }
}
