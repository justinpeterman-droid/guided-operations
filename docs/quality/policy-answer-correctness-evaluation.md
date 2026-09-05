# Policy Expert answer-correctness evaluation

## Purpose and scope

`evaluatePolicyCorrectnessSuite` in
`src/server/ai/policy-correctness-evaluation.ts` adds a version-2 evaluation
around the existing version-1 policy evaluation. Citation identity and answer
meaning are measured separately. This is an offline qualification tool, not a
new production request guard or a claim that a model understands every source.
It makes no provider calls itself and does not activate a corpus or switch a
model. The caller supplies the existing provider-neutral answer runner and a
separate reviewer.

Run the fictional regression lane with `npm run test:eval`. The command includes
both existing suites and the new correctness suite in CI's Web quality job.
Version-1 suites remain compatible; their passing result does not claim answer
correctness. The shared request schema now also preserves up to six previous
user questions for follow-up evaluation, matching the answer service.

## Reference and review contract

A version-2 suite retains the version-1 corpus/model/retrieval/configuration
identifiers, thresholds, and required evaluation categories. It also requires an
opaque `rubricVersion` and `rubricReviewReference`. These are operator
attestations, not authentication or proof of approval.

Every case except an expected provider outage requires a private `correctness`
rubric with:

- A reviewed `referenceAnswer` that explains the expected meaning.
- `referenceSources`: exact immutable citation objects, including source hash,
  version, chunk, page, and excerpt. They agree with the case's citation scope.
- `expectedFacts`: bounded IDs and factual statements, each linked to its
  supporting reference chunk IDs. Answered and conflict cases require source
  links. Refusal expectations may instead describe an evidence limitation with
  no source assertion.
- `forbiddenClaims`: bounded IDs and statements that must not appear, including
  reversed obligations, unsupported extensions, or omitted exceptions expressed
  as blanket rules.

The reviewer receives a private packet containing the rubric, question and
follow-up context, exact observed answer and limitations, citations, and the
corpus/model/configuration identifiers. The reviewer returns:

- The packet's SHA-256 and an opaque reviewer evidence reference.
- Exactly one `supported`, `missing`, or `contradicted` verdict per expected
  fact, with no duplicates or unknown IDs.
- Exactly one presence decision per forbidden claim.
- The number of other unsupported material claims, including claims made in
  limitations. Checking only the expected facts is insufficient.
- An explicit attestation that every material claim in the answer and all
  limitations was reviewed.

The packet hash binds the review to this exact response, rubric, source
evidence, question/history, and model/retrieval configuration. It prevents
accidental reuse after a change; it is not a signature and does not prove the
reviewer's judgment was sound. The answering model must not review itself.
Human-reviewed expectations and independent review own acceptance. A future
model-judge adapter would require separate calibration, provider approval, cost
controls, and human review; none is installed or called by this change.

## Two-pass operator use

1. Prepare the suite and reference rubric in the approved evaluation
   environment. Keep real corpus sources and all content-bearing packets out of
   Git, CI, logs, local development, Preview, and ordinary support exports.
2. Run the approved answer runner while capturing each exact response privately.
   A reviewer callback can collect its packets and return `undefined`; this
   yields `not_reviewed` and a failed correctness gate, never a provisional
   pass. The suite/rubric is not passed to the answering model.
3. Independently review those packets, including paraphrases, omissions,
   conflicting evidence, and limitations. Retain the review records alongside
   the exact saved responses in the same approved private environment.
4. Replay the saved responses through `evaluatePolicyCorrectnessSuite`, using
   `createRecordedPolicyCorrectnessReviewer(records)` for the review callback.
   Replaying avoids making fresh paid model calls or grading a different answer
   with an old review. Re-running live generation requires fresh reviews when
   output changes.
5. Retain only the returned scorecard in ordinary qualification evidence. Each
   valid review contributes a hash of its review record for private evidence
   reconciliation; the record itself and reviewer identity are not returned.

Example invocation, with the approved private inputs supplied by the operator:

```typescript
const scorecard = await evaluatePolicyCorrectnessSuite(
  savedResponseRunner,
  reviewedSuite,
  {
    reviewer: createRecordedPolicyCorrectnessReviewer(privateReviewRecords),
    reviewTimeoutMs: 5000,
  },
);
```

Review callbacks have a default five-second timeout, configurable from 1 ms to
60 seconds. The callback receives an abort signal and must honor it for any
external work. The evaluator stops waiting on timeout and reports
`review_unavailable`; it cannot forcibly terminate a non-cooperative callback.
Interactive human review should therefore use the two-pass process rather than
hold a callback open while someone reads an answer. Model-response latency is
measured by the existing runner clock and excludes subsequent review time.

## Scoring and failure behavior

`baselineMetrics` and `baselineThresholdResults` preserve version-1 citation,
status, refusal, injection-marker, and latency results. Version-2 metrics add
review coverage, correctness pass rate, expected-fact coverage, and the rate of
reviewed answers containing unsupported, contradictory, or forbidden claims. The
unsupported-answer rate is `null` when nothing was reviewed; it must not be
reported as zero. Missing review contributes zero to coverage and correctness.

Each case retains only safe identifiers, booleans, counts, rates, timings,
closed status codes, and a review-evidence hash. No question, reference answer,
candidate answer, excerpt, raw error, reviewer identity, or source object path
is returned. Private rubric contents are not echoed in ordinary scorecards.

A complete pass requires every case to pass both applicable gates, in addition
to the configured baseline thresholds. Relaxing an overall baseline threshold
cannot hide a failed case. A content-bearing answer passes correctness only when
all expected facts are supported, their exact required passages are cited, no
forbidden claim is present, and no additional unsupported claim is found. Source
provenance and expected status are checked independently of the reviewer.

Missing, duplicate, malformed, incomplete, or wrong-packet reviews cannot pass.
Malformed answer output and runner/reviewer failures are reported without raw
error content. Provider-outage cases do not claim correctness for nonexistent
answers, but still must satisfy their baseline expected outcome.

## Fictional evidence and remaining qualification

The developer-authored regression matrix has 29 fictional cases: three variants
each for obligations, quantities, deadlines, exceptions, actors, versions,
follow-up context, and mixed supported/unsupported claims, plus refusal, access
limitation, prompt injection, conflicting sources, and provider outage. The
variants include faithful wording, a valid paraphrase, and a wrong answer with
an otherwise genuine citation.

The existing citation/status lane passes all 29 fixtures. Independent fixture
reviews make all eight wrong answers fail correctness, while 21 faithful or
appropriately limited outcomes pass. Removing the deliberately wrong variants
produces a fully passing suite. These are deterministic test verdicts, not
actual human acceptance or measured production-model accuracy. Additional tests
cover missing facts/reviews, unsupported limitation text, malformed outputs,
timeouts, stale review hashes, source mismatches, and scorecard privacy.

Next qualification is to approve a real evaluation rubric, refresh aggregate
corpus readiness in the approved environment, capture responses from the pinned
model, and independently review them. This implementation does not claim to
close production answer accuracy, corpus activation, provider budgets, or human
acceptance. No hosted reads or writes are required for the local tests.

## Local implementation verification — 2026-09-05

Prepared on `feat/policy-answer-correctness`, based on main commit
`2b8783597e9d37302cf9c06ce11fc7e8901235fd`, independently of the PR #45 repair.
Formatting, full ESLint, TypeScript, and the production build passed. The full
application run passed 815 tests with one existing skipped test; all 69
operations tests passed. After the final runner-metadata privacy regression was
added, all 33 focused evaluation tests, TypeScript, focused ESLint, the build,
and the runtime logging boundary passed again.

No database schema, UI, production generation prompt, or model setting changed.
The pre-existing main-branch database types/inventory omissions are addressed by
the separate PR #45 repair; database qualification was not rerun for this
evaluation-only branch. GitHub checks and publication remain outstanding.
