# PR #45 repair and project assessment

## Scope and revisions

- Reviewed on 2026-09-05.
- GitHub `main`: `2b8783597e9d37302cf9c06ce11fc7e8901235fd`.
- PR #45 head: `40edf4cd02cb3d1314df7527a2c3876627e94855`, directly based on
  that main revision. The PR changes only `tools/policy-ingestion/uv.lock`.
- Repair prepared locally on `fix/pr45-database-types` in an isolated checkout.
- Existing dirty UI and local-validation checkouts were preserved.
- No hosted database, corpus, provider configuration, deployment, or merge was
  changed. The hosted corpus's current approval and embedding counts were not
  queried; the older counts in README are historical evidence.

## Database workflow failure and correction

The
[failed PR run](https://github.com/justinpeterman-droid/guided-operations/actions/runs/33754321716)
stopped at generated-type verification. Migration
`20260902090000_add_officer_feedback_and_form_intake.sql` already defines eight
API functions that were absent from `database.generated.ts`. This mismatch is
also present on the PR's main-branch base; the Torch update did not introduce
it.

Regenerating the types with the pinned Supabase CLI 2.115.0 added the missing
eight function definitions (116 lines). No SQL, grants, runtime behavior, or
dependency versions were changed by this repair.

After the type check passed, the next workflow step exposed a second omission:
the production data inventory did not include the four feedback/intake tables or
the private `form-candidate-quarantine` bucket. The inventory now covers them
and describes their actual content, purpose, and remaining deletion work.

Feedback messages and status history are retained with their parent request
under the existing two-year record rule. Candidate-file retention and cleanup
remain explicitly pending: the implemented seven-day upload expiry is not a
deletion job or an approved object-retention policy. No new deletion authority
was introduced.

## Local verification

An unlinked, disposable PostgreSQL 17 database used project ID
`guided-operations-pr45-astra` and loopback port `55422`. The existing local
database on `54322` was not reset. Validation-only configuration changes are
excluded from the repair.

| Check                                                         | Result                                                                      |
| ------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Generated-type check before repair                            | Failed with the same mismatch as GitHub                                     |
| Clean migration and fictional-seed replay                     | Passed                                                                      |
| SQL lint, warnings treated as failures                        | Passed                                                                      |
| pgTAP, including feedback and Storage authorization negatives | 27 files, 666 tests passed                                                  |
| Generated-type check after repair                             | Passed                                                                      |
| Inventory before repair                                       | Failed on the four missing tables; the bucket was also absent               |
| Inventory after repair                                        | Passed: 38 private tables, 3 buckets, 12 external surfaces                  |
| Python 3.12 policy-ingestion suite with psycopg 3.3.4         | 90 tests passed, including both local PostgreSQL integrations               |
| Formatting, ESLint, TypeScript                                | Passed                                                                      |
| Vitest                                                        | 790 tests passed; 1 existing test skipped                                   |
| Operations tests                                              | 69 passed                                                                   |
| Production build                                              | Passed locally                                                              |
| Torch lockfile consistency, `uv lock --check`                 | Passed                                                                      |
| Secret and runtime logging checks                             | Passed                                                                      |
| npm audit and signatures                                      | Zero vulnerabilities; 461 verified registry signatures and 132 attestations |

The existing generated-type and inventory guards provide direct regression
coverage: each failed on the original artifacts and passed on the corrected
artifacts against the same migrated schema. A second test duplicating these
schema comparisons was not added. No UI or application behavior changed, so a
new browser qualification was not required for this repair. Local web checks
used supported Node 24.16.0; GitHub pins Node 22.

This does not prove MinerU inference compatibility with Torch 2.13.0: no model
weights were downloaded and no OCR inference was run. The optional model
environment is separate from the dependency-free ingestion unit-test path.
GitHub checks still refer to the original PR head until the repair is published.

## Highest-value next improvement: measure answer correctness

Extend the existing Policy Expert evaluation to judge whether an answer's
material claims are supported by the passages it cites. This is the highest
priority code improvement identified by this assessment because answer accuracy
is the first priority in `AGENTS.md`, and the present checks establish citation
identity more strongly than they establish answer meaning.

Evidence:

1. `src/features/policy/grounding.ts` validates the exact document, version,
   chunk, hash, page range, and excerpt of each returned citation. It does not
   compare the answer's assertions with the excerpt's meaning.
2. A local fictional-only probe supplied the excerpt, "A fictional training
   exercise requires a review before completion," and the contradictory answer,
   "A fictional training exercise never requires a review." With the exact
   citation attached, `validateGroundedPolicyAnswer` accepted it as `answered`.
   This proves a validator limitation, not an observed live-model failure.
3. `src/server/ai/policy-evaluation.ts` scores status, citation stable-key
   recall/precision, forbidden output fragments, and latency. It has no
   independent expected-fact or claim-support judgment. The synthetic lane uses
   deterministic retrieval and generation implementations, so passing it cannot
   measure the production model's answer accuracy.
4. The generation prompt instructs the model to support every material
   statement, but a prompt instruction is not an independent correctness test.
   `docs/architecture/ai-rag.md` already calls for an unsupported-claim measure
   and owner acceptance; this recommendation completes that existing work.

Recommended bounded next assignment:

- Extend the current evaluation format with reviewed expected facts, forbidden
  claims, and claim-to-passage review outcomes. Preserve content-free retained
  scorecards and the existing provider-neutral interfaces.
- Begin with a proposed 20-30 fictional cases covering reversed obligations,
  wrong numbers or deadlines, omitted exceptions, wrong actor, wrong policy
  version, follow-up context, mixed supported/unsupported claims, and refusal.
- Make a deliberately contradictory answer with a genuine citation fail the
  evaluation; require a faithful answer to pass and appropriate refusals to
  remain accepted. Include paraphrases to avoid rewarding only exact wording.
- Report correctness separately from citation identity, retrieval quality,
  latency, and cost. Human-reviewed expected answers remain the reference; an
  automated model judge, if used, is supporting evidence.
- Obtain a read-only, aggregate refresh of hosted corpus readiness before
  planning any live qualification. Run the authorized private corpus/model
  evaluation only in its approved environment and under separately approved
  provider usage. Do not copy real corpus content into local tests.

Acceptance: the known contradictory-answer probe fails, faithful paraphrases
pass, refusal tests remain green, and the scorecard exposes unsupported-claim
results without storing question, answer, or excerpt content. No production
model switch or corpus activation is part of this recommendation.

## Other assessment results and handoff

Current-main
[Web quality](https://github.com/justinpeterman-droid/guided-operations/actions/runs/33690684996)
and
[Authenticated browser quality](https://github.com/justinpeterman-droid/guided-operations/actions/runs/33690684984)
passed on `2b8783597e9d37302cf9c06ce11fc7e8901235fd`. Older documents describing
unavailable Actions or pending earlier reruns must not be treated as current
results. Hosted recovery, monitoring, and corpus activation remain documented
gaps whose current operational state was not independently verified here.

The initial assessment stopped before publication under its no-deployment
instruction. The owner subsequently authorized pushing and merging PR #45. The
next action is to publish this correction and require the complete GitHub checks
to pass on the updated head before merging. Publishing may trigger the existing
Vercel integration; no manual deployment, hosted data migration, or production
infrastructure change is included in that authorization.
