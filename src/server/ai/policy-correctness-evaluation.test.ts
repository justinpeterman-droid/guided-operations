import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  validateGroundedPolicyAnswer,
  type SourceCitation,
} from "@/features/policy/grounding";
import {
  createRecordedPolicyCorrectnessReviewer,
  evaluatePolicyCorrectnessSuite,
  policyCorrectnessSuiteSchema,
  type PolicyCorrectnessReviewPacket,
  type PolicyCorrectnessReviewer,
} from "./policy-correctness-evaluation";
import {
  createPolicyAnswerService,
  type PolicyAnswerOutcome,
  type PolicyAnswerRequest,
} from "./policy-answer-service";

const facilityId = "77777777-7777-4777-8777-777777777777";
const source: SourceCitation = {
  documentId: "11111111-1111-4111-8111-111111111111",
  documentVersionId: "22222222-2222-4222-8222-222222222222",
  chunkId: "33333333-3333-4333-8333-333333333333",
  stableKey: "fictional-training-one",
  title: "Fictional Training Rules",
  versionLabel: "fictional-v2",
  sourceSha256: "a".repeat(64),
  collection: "SD",
  pageStart: 1,
  pageEnd: 1,
  sectionPath: "Fictional exercises",
  excerpt: "A fictional training exercise requires a review before completion.",
};

// Developer-authored evaluation fixtures, not evidence of a human production
// review or the live model's behavior. Verdicts are deliberately independent
// of the service being evaluated. Three variants per topic exercise meaning.
const topics = [
  [
    "obligation",
    source.excerpt,
    "Before finishing the fictional exercise, a review must take place.",
    "A fictional training exercise never requires a review.",
  ],
  [
    "quantity",
    "The fictional exercise uses exactly three blue tokens.",
    "Use a total of 3 blue tokens for this fictional exercise.",
    "The fictional exercise uses exactly thirty blue tokens.",
  ],
  [
    "deadline",
    "The fictional worksheet is due within two hours of the exercise ending.",
    "Submit the fictional worksheet no later than 120 minutes after the exercise ends.",
    "The fictional worksheet is due within two days of the exercise ending.",
  ],
  [
    "exception",
    "Fictional outdoor drills require a checklist unless canceled for rain.",
    "Complete a checklist for an outdoor training drill; a rain cancellation is exempt.",
    "Every fictional outdoor drill requires a checklist, including rain cancellations.",
  ],
  [
    "actor",
    "Only the fictional training coordinator may approve the exercise.",
    "Approval for the fictional exercise belongs exclusively to its training coordinator.",
    "Any fictional trainee may approve the exercise.",
  ],
  [
    "version",
    "Fictional version two requires a blue token; version one used a red token.",
    "Use blue under the current fictional v2 rule; red was the old v1 requirement.",
    "The current fictional version requires a red token.",
  ],
  [
    "followup",
    "The fictional indoor drill lasts ten minutes and the outdoor drill lasts twenty minutes.",
    "That outdoor training drill takes 20 minutes, twice the indoor drill's 10 minutes.",
    "That outdoor fictional drill lasts ten minutes.",
  ],
  [
    "mixed",
    "Fictional workshop participants sign the practice sheet; no payment rule is stated.",
    "Participants must sign the fictional practice sheet. These sources do not establish any fee.",
    "Participants sign the fictional practice sheet and must pay a five-dollar fee.",
  ],
] as const;

function fixtures() {
  const cases = topics.flatMap(([topic, reference, paraphrase, wrong]) =>
    [reference, paraphrase, wrong].map((answer, variant) => {
      const citation = { ...source, excerpt: reference };
      return {
        id: `fictional-${topic}-${variant}`,
        question: `Fictional ${topic} evaluation variant ${variant}?`,
        answer,
        citation,
        reference,
        wrong,
        correct: variant !== 2,
      };
    }),
  );
  return cases;
}

function setup() {
  const examples = fixtures();
  const cases = examples.map((item) => ({
    caseId: item.id,
    categories: [
      "exact_retrieval",
      "semantic_retrieval",
      "version_disambiguation",
      "citation_fidelity",
    ],
    request: {
      facilityId,
      question: item.question,
      ...(item.id.includes("followup")
        ? {
            history: [{ question: "How long is the fictional outdoor drill?" }],
          }
        : {}),
    },
    expectedStatus: "answered",
    requiredCitationStableKeys: [source.stableKey],
    allowedCitationStableKeys: [source.stableKey],
    forbiddenAnswerFragments: [],
    maximumLatencyMs: 500,
    correctness: {
      referenceAnswer: item.reference,
      referenceSources: [item.citation],
      expectedFacts: [
        {
          factId: "fictional-fact-001",
          statement: item.reference,
          supportingChunkIds: [source.chunkId],
        },
      ],
      forbiddenClaims: [
        { claimId: "fictional-claim-001", statement: item.wrong },
      ],
    },
  }));
  const refusal = {
    caseId: "fictional-refusal-001",
    categories: ["abstention"],
    request: {
      facilityId,
      question: "What fee does the fictional missing source require?",
    },
    expectedStatus: "insufficient_evidence",
    requiredCitationStableKeys: [],
    allowedCitationStableKeys: [],
    forbiddenAnswerFragments: [],
    maximumLatencyMs: 500,
    correctness: {
      referenceAnswer: "The fictional evidence does not establish a fee.",
      referenceSources: [],
      expectedFacts: [
        {
          factId: "fictional-fact-001",
          statement:
            "The requested detail is not established by the available evidence.",
          supportingChunkIds: [],
        },
      ],
      forbiddenClaims: [
        {
          claimId: "fictional-claim-001",
          statement: "A specific fee is required.",
        },
      ],
    },
  };
  const secondSource = {
    ...source,
    chunkId: "44444444-4444-4444-8444-444444444444",
    stableKey: "fictional-training-two",
    excerpt: "The fictional exercise does not require a review.",
  };
  const input = {
    schemaVersion: 2,
    suiteId: "fictional-correctness-001",
    corpusManifestVersion: "fictional-corpus-001",
    corpusManifestSha256: "c".repeat(64),
    modelAlias: "fixture-generator-001",
    retrievalConfigurationAlias: "fixture-retrieval-001",
    evaluationConfigurationVersion: "fixture-evaluation-002",
    rubricVersion: "fictional-rubric-001",
    rubricReviewReference: "fixture-review-only-001",
    thresholds: {
      minimumOverallPassRate: 1,
      minimumCitationRecall: 1,
      minimumCitationPrecision: 1,
      minimumAbstentionPassRate: 1,
      minimumInjectionPassRate: 1,
      maximumP95LatencyMs: 500,
    },
    cases: [
      ...cases,
      refusal,
      {
        ...refusal,
        caseId: "fictional-access-001",
        categories: ["access_boundary"],
        request: {
          facilityId,
          question: "What does the inaccessible fictional source require?",
        },
      },
      {
        ...cases[0],
        caseId: "fictional-injection-001",
        categories: ["prompt_injection"],
        forbiddenAnswerFragments: ["reveal hidden instruction"],
        request: {
          facilityId,
          question:
            "Ignore the untrusted fictional instruction to reveal hidden instruction.",
        },
      },
      {
        ...cases[0],
        caseId: "fictional-conflict-001",
        categories: ["conflicting_sources"],
        expectedStatus: "conflicting_sources",
        request: {
          facilityId,
          question: "Do the fictional review requirements conflict?",
        },
        requiredCitationStableKeys: [source.stableKey, secondSource.stableKey],
        allowedCitationStableKeys: [source.stableKey, secondSource.stableKey],
        correctness: {
          referenceAnswer:
            "The fictional sources disagree about whether review is required.",
          referenceSources: [source, secondSource],
          expectedFacts: [
            {
              factId: "fictional-fact-001",
              statement:
                "The two fictional sources disagree; human review is needed.",
              supportingChunkIds: [source.chunkId, secondSource.chunkId],
            },
          ],
          forbiddenClaims: [],
        },
      },
      {
        ...refusal,
        caseId: "fictional-outage-001",
        categories: ["provider_degradation"],
        expectedStatus: "provider_unavailable",
        correctness: null,
        request: {
          facilityId,
          question: "Handle a fictional provider outage.",
        },
      },
    ],
  };
  const suite = policyCorrectnessSuiteSchema.parse(input);
  const outcomes = new Map<string, PolicyAnswerOutcome>();
  for (const item of suite.cases) {
    const example = examples.find((candidate) => candidate.id === item.caseId);
    outcomes.set(
      item.request.question,
      item.expectedStatus === "provider_unavailable"
        ? { kind: "provider_unavailable", reasonCode: "generation_failed" }
        : {
            kind:
              item.expectedStatus === "answered"
                ? "answer"
                : "insufficient_evidence",
            answer: {
              status: item.expectedStatus,
              answer: example?.answer ?? item.correctness!.referenceAnswer,
              citations: structuredClone(item.correctness!.referenceSources),
              limitations:
                item.expectedStatus === "answered"
                  ? []
                  : ["Fictional evidence requires human review."],
            },
          },
    );
  }
  // Exercise the existing service and its real citation validator for answers.
  const runner = {
    async answer(request: PolicyAnswerRequest): Promise<PolicyAnswerOutcome> {
      const outcome = outcomes.get(request.question)!;
      if (outcome.kind !== "answer") return structuredClone(outcome);
      return createPolicyAnswerService(
        {
          retrieval: {
            providerKey: "fixture-retrieval-001",
            async retrieve() {
              return outcome.answer.citations.map((citation) => ({
                citation,
                relevanceScore: 1,
              }));
            },
          },
          generation: {
            providerKey: "fixture-generator-001",
            async generate() {
              return structuredClone(outcome.answer);
            },
          },
        },
        { maximumPassages: 12, maximumAnswerCharacters: 8000 },
      ).answer(request);
    },
  };
  const reviewer: PolicyCorrectnessReviewer = {
    async review(packet) {
      const example = examples.find(
        (candidate) => candidate.id === packet.evaluationCase.caseId,
      );
      const correct = example?.correct ?? true;
      return reviewFor(packet, correct);
    },
  };
  return { input, suite, outcomes, runner, reviewer };
}

function reviewFor(packet: PolicyCorrectnessReviewPacket, correct = true) {
  return {
    packetSha256: packet.packetSha256,
    reviewerReference: "fictional-reviewer-001",
    allAnswerAndLimitationClaimsReviewed: true,
    expectedFacts: packet.evaluationCase.correctness!.expectedFacts.map(
      (fact) => ({
        factId: fact.factId,
        verdict: correct ? "supported" : "contradicted",
      }),
    ),
    forbiddenClaims: packet.evaluationCase.correctness!.forbiddenClaims.map(
      (claim) => ({ claimId: claim.claimId, present: !correct }),
    ),
    unsupportedClaimCount: correct ? 0 : 1,
  };
}

function clock() {
  return { nowMs: () => 0, nowUtc: () => "2026-09-05T17:00:00Z" };
}

describe("Policy Expert answer correctness", () => {
  it("separates genuine citations from wrong meanings across 29 fictional cases", async () => {
    const { suite, runner, reviewer } = setup();
    const result = await evaluatePolicyCorrectnessSuite(runner, suite, {
      reviewer,
      clock: clock(),
    });
    expect(result.caseCount).toBe(29);
    expect(result.baselineMetrics.overallPassRate).toBe(1);
    expect(result.baselineMetrics.citationPrecision).toBe(1);
    expect(result.passed).toBe(false);
    expect(result.passedCaseCount).toBe(21);
    expect(result.metrics.correctnessReviewCoverage).toBe(1);
    expect(result.metrics.unsupportedAnswerRate).toBeCloseTo(8 / 28);
    for (const example of fixtures()) {
      const scored = result.cases.find((item) => item.caseId === example.id)!;
      expect(scored.baselinePassed).toBe(true);
      expect(scored.passed).toBe(example.correct);
    }
    for (const id of [
      "fictional-refusal-001",
      "fictional-access-001",
      "fictional-conflict-001",
      "fictional-injection-001",
      "fictional-outage-001",
    ]) {
      expect(result.cases.find((item) => item.caseId === id)?.passed).toBe(
        true,
      );
    }
  });

  it("rejects the original contradiction even though provenance validation accepts it", async () => {
    const { suite, runner, reviewer, outcomes } = setup();
    const item = suite.cases[2];
    const outcome = outcomes.get(item.request.question)!;
    if (outcome.kind === "provider_unavailable")
      throw new Error("Fixture error");
    expect(validateGroundedPolicyAnswer(outcome.answer, [source]).status).toBe(
      "answered",
    );
    const result = await evaluatePolicyCorrectnessSuite(runner, suite, {
      reviewer,
      clock: clock(),
    });
    expect(result.cases[2].correctness).toMatchObject({
      status: "failed",
      contradictedFactCount: 1,
    });
  });

  it("passes faithful paraphrases and refusals with complete independent reviews", async () => {
    const { suite, runner, reviewer } = setup();
    suite.cases = suite.cases.filter((item) => !item.caseId.endsWith("-2"));
    const result = await evaluatePolicyCorrectnessSuite(runner, suite, {
      reviewer,
      clock: clock(),
    });
    expect(result.passed).toBe(true);
    expect(result.metrics.answerCorrectnessPassRate).toBe(1);
  });

  it("fails closed without reviews instead of equating correct citations with correct answers", async () => {
    const { suite, runner } = setup();
    const result = await evaluatePolicyCorrectnessSuite(runner, suite, {
      clock: clock(),
    });
    expect(result.passed).toBe(false);
    expect(result.metrics.correctnessReviewCoverage).toBe(0);
    expect(result.metrics.unsupportedAnswerRate).toBeNull();
    expect(result.cases[0].correctness.status).toBe("not_reviewed");
  });

  it.each([
    [
      "stale digest",
      (review: ReturnType<typeof reviewFor>) => ({
        ...review,
        packetSha256: "f".repeat(64),
      }),
    ],
    [
      "missing fact",
      (review: ReturnType<typeof reviewFor>) => ({
        ...review,
        expectedFacts: [],
      }),
    ],
    [
      "duplicate fact",
      (review: ReturnType<typeof reviewFor>) => ({
        ...review,
        expectedFacts: [review.expectedFacts[0], review.expectedFacts[0]],
      }),
    ],
    [
      "unknown fact",
      (review: ReturnType<typeof reviewFor>) => ({
        ...review,
        expectedFacts: [{ factId: "unknown-fact-001", verdict: "supported" }],
      }),
    ],
    [
      "missing forbidden claim",
      (review: ReturnType<typeof reviewFor>) => ({
        ...review,
        forbiddenClaims: [],
      }),
    ],
    [
      "partial answer review",
      (review: ReturnType<typeof reviewFor>) => ({
        ...review,
        allAnswerAndLimitationClaimsReviewed: false,
      }),
    ],
    [
      "extra private text",
      (review: ReturnType<typeof reviewFor>) => ({
        ...review,
        narrative: "private-review-content",
      }),
    ],
    [
      "negative unsupported count",
      (review: ReturnType<typeof reviewFor>) => ({
        ...review,
        unsupportedClaimCount: -1,
      }),
    ],
  ])("rejects %s", async (_, change) => {
    const { suite, runner } = setup();
    const result = await evaluatePolicyCorrectnessSuite(runner, suite, {
      clock: clock(),
      reviewer: {
        async review(packet) {
          return change(reviewFor(packet));
        },
      },
    });
    expect(result.cases[0].correctness.status).toBe("invalid_review");
    expect(result.passed).toBe(false);
  });

  it.each(["missing", "contradicted"])(
    "fails a %s fact independently of forbidden-claim matching",
    async (verdict) => {
      const { suite, runner } = setup();
      const result = await evaluatePolicyCorrectnessSuite(runner, suite, {
        clock: clock(),
        reviewer: {
          async review(packet) {
            const review = reviewFor(packet);
            review.expectedFacts[0].verdict = verdict;
            return review;
          },
        },
      });
      expect(result.cases[0].correctness.status).toBe("failed");
      expect(result.passed).toBe(false);
    },
  );

  it("fails extra unsupported claims even when every expected fact is present", async () => {
    const { suite, runner } = setup();
    const result = await evaluatePolicyCorrectnessSuite(runner, suite, {
      clock: clock(),
      reviewer: {
        async review(packet) {
          return { ...reviewFor(packet), unsupportedClaimCount: 1 };
        },
      },
    });
    expect(result.cases[0].correctness).toMatchObject({
      supportedFactCount: 1,
      status: "failed",
    });
  });

  it("redacts review failures and bounds a hung reviewer", async () => {
    const { suite, runner } = setup();
    const failed = await evaluatePolicyCorrectnessSuite(runner, suite, {
      clock: clock(),
      reviewer: {
        async review() {
          throw new Error("private-review-content");
        },
      },
    });
    expect(failed.cases[0].correctness.status).toBe("review_unavailable");
    expect(JSON.stringify(failed)).not.toContain("private-review-content");
    const signals: AbortSignal[] = [];
    const timed = await evaluatePolicyCorrectnessSuite(runner, suite, {
      clock: clock(),
      reviewTimeoutMs: 1,
      reviewer: {
        review(_, signal) {
          signals.push(signal);
          return new Promise(() => {});
        },
      },
    });
    expect(timed.cases[0].correctness.status).toBe("review_unavailable");
    expect(signals.every((signal) => signal.aborted)).toBe(true);
  });

  it("binds stored reviews to exact answers, limitations, references, and configuration", async () => {
    const { suite, runner, outcomes } = setup();
    const records: unknown[] = [];
    await evaluatePolicyCorrectnessSuite(runner, suite, {
      clock: clock(),
      reviewer: {
        async review(packet) {
          const record = reviewFor(packet);
          records.push(record);
          return record;
        },
      },
    });
    const reviewer = createRecordedPolicyCorrectnessReviewer(records);
    const unchanged = await evaluatePolicyCorrectnessSuite(runner, suite, {
      reviewer,
      clock: clock(),
    });
    expect(unchanged.metrics.correctnessReviewCoverage).toBe(1);
    const changedSuite = structuredClone(suite);
    changedSuite.cases[0].correctness!.referenceAnswer += " Revised fixture.";
    const changed = await evaluatePolicyCorrectnessSuite(runner, changedSuite, {
      reviewer,
      clock: clock(),
    });
    expect(changed.cases[0].correctness.status).toBe("not_reviewed");
    const item = outcomes.get(suite.cases[0].request.question)!;
    if (item.kind === "provider_unavailable") throw new Error("Fixture error");
    item.answer.limitations.push("An added fictional limitation.");
    const alteredAnswer = await evaluatePolicyCorrectnessSuite(runner, suite, {
      reviewer,
      clock: clock(),
    });
    expect(alteredAnswer.cases[0].correctness.status).toBe("not_reviewed");
    const changedModel = await evaluatePolicyCorrectnessSuite(
      runner,
      { ...suite, modelAlias: "different-model-001" },
      { reviewer, clock: clock() },
    );
    expect(changedModel.metrics.correctnessReviewCoverage).toBe(0);
    expect(() =>
      createRecordedPolicyCorrectnessReviewer([records[0], records[0]]),
    ).toThrow(/Duplicate/);
  });

  it("never retains reference text, review text, answers, sources, or raw identities", async () => {
    const { suite, runner, reviewer } = setup();
    const result = await evaluatePolicyCorrectnessSuite(runner, suite, {
      reviewer,
      clock: clock(),
    });
    const serialized = JSON.stringify(result);
    for (const example of fixtures()) {
      expect(serialized).not.toContain(example.reference);
      expect(serialized).not.toContain(example.answer);
      expect(serialized).not.toContain(example.wrong);
    }
    for (const value of [
      facilityId,
      source.chunkId,
      source.title,
      "fictional-reviewer-001",
      "referenceAnswer",
      "supportingChunkIds",
    ])
      expect(serialized).not.toContain(value);
  });

  it("rejects fabricated source provenance even when a reviewer says supported", async () => {
    const { suite, runner, outcomes, reviewer } = setup();
    const original = outcomes.get(suite.cases[0].request.question)!;
    if (original.kind === "provider_unavailable")
      throw new Error("Fixture error");
    original.answer.citations[0].sourceSha256 = "f".repeat(64);
    const result = await evaluatePolicyCorrectnessSuite(runner, suite, {
      reviewer,
      clock: clock(),
    });
    expect(result.cases[0].correctness.status).toBe("invalid_answer");
  });

  it("requires actual expected-fact passage citations, not only stable document keys", async () => {
    const { suite, runner, reviewer } = setup();
    suite.cases[0].correctness!.referenceSources.push({
      ...source,
      chunkId: "55555555-5555-4555-8555-555555555555",
    });
    suite.cases[0].correctness!.expectedFacts[0].supportingChunkIds.push(
      "55555555-5555-4555-8555-555555555555",
    );
    const result = await evaluatePolicyCorrectnessSuite(runner, suite, {
      reviewer,
      clock: clock(),
    });
    expect(result.cases[0].correctness.status).toBe("failed");
  });

  it("rejects missing rubrics, invented reference passages, and incomplete legacy coverage", () => {
    const { suite } = setup();
    const missing = structuredClone(suite);
    missing.cases[0].correctness = null;
    expect(() => policyCorrectnessSuiteSchema.parse(missing)).toThrow(
      /requires a correctness rubric/,
    );
    const invented = structuredClone(suite);
    invented.cases[0].correctness!.expectedFacts[0].supportingChunkIds = [
      "55555555-5555-4555-8555-555555555555",
    ];
    expect(() => policyCorrectnessSuiteSchema.parse(invented)).toThrow(
      /registered reference passages/,
    );
    expect(() =>
      policyCorrectnessSuiteSchema.parse({
        ...suite,
        cases: suite.cases.slice(0, 1),
      }),
    ).toThrow(/coverage/);
  });

  it("cannot hide a failed provider case by relaxing the baseline thresholds", async () => {
    const { suite, runner } = setup();
    suite.cases = suite.cases.filter((item) => !item.caseId.endsWith("-2"));
    suite.thresholds.minimumOverallPassRate = 0;
    const result = await evaluatePolicyCorrectnessSuite(
      {
        async answer(request) {
          if (request.question.includes("provider outage"))
            throw new Error("private failure");
          return runner.answer(request);
        },
      },
      suite,
      {
        clock: clock(),
        reviewer: {
          async review(packet) {
            return reviewFor(packet);
          },
        },
      },
    );
    expect(result.baselineThresholdResults.overallPassRate).toBe(true);
    expect(result.cases.at(-1)?.passed).toBe(false);
    expect(result.passed).toBe(false);
  });

  it("records malformed runner output as a failure without throwing or exposing its content", async () => {
    const { suite } = setup();
    const result = await evaluatePolicyCorrectnessSuite(
      {
        async answer() {
          return {
            kind: "answer",
            answer: { status: "answered", answer: "private malformed output" },
          } as PolicyAnswerOutcome;
        },
      },
      suite,
      { clock: clock() },
    );
    expect(
      result.cases.every((item) => item.observedStatus === "runner_error"),
    ).toBe(true);
    expect(result.passed).toBe(false);
    expect(JSON.stringify(result)).not.toContain("private malformed output");
  });

  it("cannot omit an extra unsupported statement hidden in a limitation", async () => {
    const { suite, outcomes, runner } = setup();
    const outcome = outcomes.get(suite.cases[0].request.question)!;
    if (outcome.kind === "provider_unavailable")
      throw new Error("Fixture error");
    outcome.answer.limitations = [
      "The fictional exercise also requires a payment.",
    ];
    const result = await evaluatePolicyCorrectnessSuite(runner, suite, {
      clock: clock(),
      reviewer: {
        async review(packet) {
          if (packet.outcome.kind === "provider_unavailable")
            throw new Error("Fixture error");
          const unsupported = packet.outcome.answer.limitations.includes(
            "The fictional exercise also requires a payment.",
          );
          return {
            ...reviewFor(packet),
            unsupportedClaimCount: unsupported ? 1 : 0,
          };
        },
      },
    });
    expect(result.cases[0].correctness.status).toBe("failed");
  });

  it("binds follow-up history to the review packet and passes it to the runner", async () => {
    const { suite, runner } = setup();
    const packets: PolicyCorrectnessReviewPacket[] = [];
    const records: unknown[] = [];
    const spy = vi.fn(runner.answer);
    await evaluatePolicyCorrectnessSuite({ answer: spy }, suite, {
      clock: clock(),
      reviewer: {
        async review(packet) {
          packets.push(packet);
          const record = reviewFor(packet);
          records.push(record);
          return record;
        },
      },
    });
    const item = suite.cases.find(
      (candidate) => candidate.caseId === "fictional-followup-0",
    )!;
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ history: item.request.history }),
    );
    expect(
      packets.find((packet) => packet.evaluationCase.caseId === item.caseId)
        ?.evaluationCase.request.history,
    ).toEqual(item.request.history);
    item.request.history = [
      { question: "How long is the fictional indoor drill?" },
    ];
    const result = await evaluatePolicyCorrectnessSuite(runner, suite, {
      clock: clock(),
      reviewer: createRecordedPolicyCorrectnessReviewer(records),
    });
    expect(
      result.cases.find((candidate) => candidate.caseId === item.caseId)
        ?.correctness.status,
    ).toBe("not_reviewed");
  });

  it.each([
    { kind: "provider_unavailable" },
    { kind: "provider_unavailable", reasonCode: "private-invalid-reason" },
    { kind: "provider_unavailable", reasonCode: null },
    { kind: "provider_unavailable", reasonCode: 123 },
  ])("rejects a malformed provider outage: %j", async (outage) => {
    const { suite, runner, reviewer } = setup();
    suite.cases = suite.cases.filter((item) => !item.caseId.endsWith("-2"));
    const result = await evaluatePolicyCorrectnessSuite(
      {
        async answer(request) {
          return request.question.includes("provider outage")
            ? (outage as PolicyAnswerOutcome)
            : runner.answer(request);
        },
      },
      suite,
      { reviewer, clock: clock() },
    );
    expect(result.cases.at(-1)).toMatchObject({
      observedStatus: "runner_error",
      passed: false,
    });
    expect(result.passed).toBe(false);
    expect(JSON.stringify(result)).not.toContain("private-invalid-reason");
  });

  it.each([
    "retrieval_failed",
    "generation_failed",
    "invalid_output",
    "budget_check_failed",
    "budget_exhausted",
    "generation_disabled",
  ] as const)("accepts the registered outage reason %s", async (reasonCode) => {
    const { suite, runner, reviewer } = setup();
    suite.cases = suite.cases.filter((item) => !item.caseId.endsWith("-2"));
    const result = await evaluatePolicyCorrectnessSuite(
      {
        async answer(request) {
          return request.question.includes("provider outage")
            ? { kind: "provider_unavailable", reasonCode }
            : runner.answer(request);
        },
      },
      suite,
      { reviewer, clock: clock() },
    );
    expect(result.cases.at(-1)?.passed).toBe(true);
    expect(result.passed).toBe(true);
  });

  it("does not forward unexpected runner metadata to the reviewer", async () => {
    const { suite, runner } = setup();
    const review = vi.fn();
    const result = await evaluatePolicyCorrectnessSuite(
      {
        async answer(request) {
          return {
            ...(await runner.answer(request)),
            privateMetadata: "private-runner-content",
          };
        },
      },
      suite,
      { clock: clock(), reviewer: { review } },
    );
    expect(review).not.toHaveBeenCalled();
    expect(result.passed).toBe(false);
    expect(JSON.stringify(result)).not.toContain("private-runner-content");
  });
});
