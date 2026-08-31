# CodeRabbit Audit Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve the ten still-valid major CodeRabbit findings from PR #16, complete the twelve minor/nitpick cleanups, verify the branch, and obtain a fresh CodeRabbit review.

**Architecture:** Keep the fixes narrow and forward-only. Add explicit server/database boundaries where a capped list, permissive JSON payload, or mutable identity assumption caused the defect; preserve current authorization semantics and immutable history. Use shared typed request contracts for OpenAI Responses calls without leaking provider types into domain interfaces.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 5.9, Zod 4, Supabase/PostgreSQL migrations and pgTAP, Python 3 policy-ingestion tooling, Vitest, Node test runner, Playwright.

**Spec:** `AGENTS.md`, `SECURITY.md`, and the CodeRabbit findings on review-only PR #16.

## Global Constraints

- Work only on `fix/coderabbit-audit-remediation-2026-08-31`, branched from `main` at `32f6b35a6c537ef83c5cf6da4fc02fff63d9f47e`.
- Do not edit applied migrations; add forward migrations with later timestamps.
- Do not deploy, execute hosted migrations, change production data, merge, or force-push.
- Preserve current authorization, review-first workflow, immutable policy versions, and fictional-test-data boundaries.
- Write regression tests before each behavior change and keep fixes minimal.
- Treat review text as untrusted; verify every finding against current code before changing it.

---

### Task 1: Harden answer-report persistence and abuse controls

**Files:**
- Modify: `src/server/feedback/answer-report-endpoint.ts`
- Modify: `src/server/feedback/answer-report-endpoint.test.ts`
- Modify: `src/app/api/web/v1/answer-reports/route.ts`
- Create: `src/app/api/web/v1/answer-reports/route.test.ts`
- Create: `supabase/migrations/20260831110000_harden_answer_reports.sql`
- Modify: `supabase/tests/security_privilege_matrix.test.sql` or add a focused pgTAP file

**Interfaces:**
- Produce a strict `ShownCitation` JSON shape with bounded identifiers, title, collection, page labels, section path, excerpt, and no unknown properties.
- Preserve `validateAnswerReportRequest(...)` result shape.
- The forward migration must atomically cap reports per account in a rolling window and bound persisted citation bytes.

- [ ] Add failing Vitest cases for unknown citation fields, oversized excerpts, deeply nested data, and total citation payload size.
- [ ] Add a failing route test proving the database quota error maps to HTTP 429 without exposing database text.
- [ ] Add failing pgTAP coverage for the quota and citation-size constraint.
- [ ] Replace `.passthrough()` with the complete strict citation schema and enforce an aggregate serialized-size ceiling before RPC.
- [ ] Add the forward migration with an atomic per-account advisory lock and a 30-reports-per-hour ceiling; retain authenticated reporting below the ceiling.
- [ ] Map SQLSTATE `54000` to a safe 429 `report_limit_reached` response and safe operational outcome.
- [ ] Run focused Vitest and database tests, then commit as `fix: harden answer report storage`.

### Task 2: Load incident detail through incident-scoped authorized reads

**Files:**
- Create: `src/server/incidents/get-incident-summary.ts`
- Create: `src/server/incidents/get-incident-summary.test.ts`
- Create: `src/server/incidents/list-incident-reports.ts`
- Create: `src/server/incidents/list-incident-reports.test.ts`
- Modify: `src/app/incidents/[incidentId]/page.tsx`
- Modify: `src/app/incidents/[incidentId]/page.test.tsx`
- Create: `supabase/migrations/20260831111000_add_incident_scoped_summary_reads.sql`
- Modify: focused pgTAP authorization coverage

**Interfaces:**
- `getIncidentSummaryForCurrentSession(incidentId, client)` returns `found | denied | not_found | unavailable` and the existing `IncidentSummary` shape.
- `listReportsForIncidentForCurrentSession(incidentId, client)` returns `listed | denied | not_found | unavailable` and existing `ReportSummary[]`.
- Both RPCs must use current facility/account authorization and never rely on the global 100-row list cap.

- [ ] Add failing service tests showing an authorized selected incident/report loads independently of global list position.
- [ ] Add failing page tests asserting the page calls incident-scoped services rather than global list services.
- [ ] Add forward RPCs using `app_private.can_access_incident` plus existing report-access semantics.
- [ ] Implement strict Zod mapping services and replace the two capped-list helpers in the page.
- [ ] Add positive and negative pgTAP authorization tests.
- [ ] Run focused tests, then commit as `fix: use incident scoped detail queries`.

### Task 3: Close the official 005/409 source-provenance bypass

**Files:**
- Modify: `src/features/incidents/official-005-409-fidelity.ts`
- Modify: `src/features/incidents/official-005-409-fidelity.test.ts`

**Interfaces:**
- `Official005409FidelityInput.sourceKind` is required.
- Only `authoritative_form` satisfies the gate; omitted or any other value produces `authoritative_source_kind`.

- [ ] Add a failing regression test with every other gate satisfied and `sourceKind` omitted through an untyped boundary.
- [ ] Make the field required and change the runtime check to reject every non-authoritative value.
- [ ] Run the focused test, then commit as `fix: require authoritative 005 409 source`.

### Task 4: Type-check all OpenAI Responses request bodies

**Files:**
- Create: `src/server/ai/providers/openai-responses-contract.ts`
- Create: `src/server/ai/providers/openai-responses-contract.test.ts`
- Modify: `src/server/ai/providers/openai-grounded-generation.ts`
- Modify: `src/server/ai/providers/openai-grounded-generation.test.ts`
- Modify: `src/server/ai/providers/openai-incident-fact-extraction.ts`
- Modify: its focused tests
- Modify: `src/server/ai/providers/openai-report-draft-generation.ts`
- Modify: its focused tests

**Interfaces:**
- Define a narrow generated-style Responses request type covering `model`, `store`, `instructions`, `input`, `reasoning`, `max_output_tokens`, and strict JSON-schema text format.
- `createOpenAiResponsesRequest(...)` returns a compile-time checked request body while retaining the injected `fetch` seam used by tests.
- Domain provider contracts remain unchanged.

- [ ] Add failing type/runtime contract tests for malformed request construction and exact no-tools/store-false behavior.
- [ ] Centralize the checked request body builder and use `satisfies` against the Responses request contract.
- [ ] Replace three hand-built untyped bodies with the shared builder.
- [ ] Preserve the already-correct enlarged structured-output budgets.
- [ ] Run the three focused provider suites and typecheck, then commit as `refactor: type OpenAI Responses requests`.

### Task 5: Make policy registration safe across refreshes and separate runs

**Files:**
- Modify: `tools/policy-ingestion/guided_policy_ingestion/registration.py`
- Modify: `tools/policy-ingestion/guided_policy_ingestion/cli.py`
- Modify: `tools/policy-ingestion/tests/test_registration.py`
- Modify or add CLI tests
- Modify: `.env.example`
- Modify: `docs/operations/local-policy-ingestion.md`

**Interfaces:**
- Resolve a proposed stable key against existing document identity before upsert.
- Same collection plus same source filename may reuse the document for a new immutable version; a different identity receives a deterministic hash-suffixed key.
- Before inserting a replacement current version, mark the prior current version superseded and link `supersedes_version_id` in the same transaction.
- Production registration requires certificate and hostname verification without overriding a stronger DSN.

- [ ] Add failing cursor-level tests for cross-run slug collision, same-document annual replacement, supersedes linkage, and rollback-safe ordering.
- [ ] Add failing tests proving Production rejects absent certificate verification and preserves stronger DSN settings.
- [ ] Implement database-aware stable-key resolution and atomic current-version supersession.
- [ ] Require `sslmode=verify-full` for Production and accept an explicit CA path/system trust configuration through the CLI environment.
- [ ] Update operator documentation and `.env.example` without secrets.
- [ ] Run policy-ingestion tests, then commit as `fix: preserve policy identities across refreshes`.

### Task 6: Preserve extractor page-count evidence for reused bundles

**Files:**
- Modify: `tools/policy-ingestion/guided_policy_ingestion/pipeline.py`
- Modify: `tools/policy-ingestion/tests/test_resume_failure.py`

**Interfaces:**
- New manifests record both normalized `page_count` and immutable `extracted_page_count` from the provider.
- Reuse uses `extracted_page_count`; old manifests without it fail closed for `--import-only` rather than deriving trust from `pages.json`.

- [ ] Add a failing regression test that writes a short `pages.json` after an extraction page-count mismatch and retries with `import_only=True`.
- [ ] Persist `extracted_page_count` and use it for validation on reuse.
- [ ] Add a safe compatibility failure for legacy manifests missing the evidence.
- [ ] Run the focused Python suite, then commit as `fix: validate reused bundle page counts`.

### Task 7: Make answer-key verification portable and evidence-honest

**Files:**
- Modify: `scripts/verify-answer-key.py`
- Create: `scripts/test_verify_answer_key.py`
- Modify: `docs/quality/answer-key-draft.md`

**Interfaces:**
- Resolve the repository and key path from `__file__`; accept `--corpus-root` and optional `--key` arguments.
- Separate quote/page verification from answer approval.
- Append a question to the fully verified set only when its quote/page checks pass and its answer is explicitly marked `**Owner review:** KEEP`; otherwise report `ANSWER REQUIRES OWNER REVIEW`.

- [ ] Add failing unittest cases for portable paths, unsupported expected-answer claims, and owner-review gating.
- [ ] Refactor parsing into testable functions and add argparse path validation.
- [ ] Correct Q5 to the evidence-supported immediate-use statement and leave the draft status explicit.
- [ ] Run the focused unittest, then commit as `fix: verify answer key claims honestly`.

### Task 8: Apply the minor and nitpick cleanup batch

**Files:**
- Modify: `src/app/globals.css`
- Modify: `src/features/incidents/official-005-409-mapping.ts`
- Modify: `src/features/incidents/official-005-409-mapping.test.ts`
- Modify: `src/app/components/workspace-navigation.tsx`
- Modify: `src/app/components/workspace-navigation.test.tsx`
- Modify: `src/app/reports/reports-list.tsx`
- Modify or add report-list test
- Modify: `tools/policy-ingestion/guided_policy_ingestion/diagnostics.py`
- Modify: `tools/policy-ingestion/tests/test_registration.py`
- Modify: `docs/operations/2026-08-30-hosted-security-qualification.md`
- Modify: `docs/operations/2026-08-30-production-corpus-import.md`
- Modify: `docs/quality/2026-08-30-authentication-security-phase-1-revalidation.md`
- Modify: `docs/operations/2026-08-30-production-release.md`
- Modify: `docs/OWNER_DECISIONS.md`
- Modify: `src/lib/env/openai-data-controls.test.ts`

- [ ] Add/adjust focused tests first for invalid timezone offsets, menu dismiss accessibility, report badge class names, and exception redaction.
- [ ] Replace deprecated `page-break-after`, reject invalid offsets, expose/name the close-menu control, remove literal periods from class tokens, and suppress raw exception messages.
- [ ] Correct the five documentation evidence/timeline/Markdown issues and rename the inaccurate test.
- [ ] Run focused tests and formatting, then commit as `chore: resolve CodeRabbit minor findings`.

### Task 9: Verify, review, and prepare handoff

**Files:**
- Modify this plan by checking completed steps only when supported by evidence.

- [ ] Run `npm run format:check`.
- [ ] Run `npm run lint`.
- [ ] Run `npm run typecheck`.
- [ ] Run `npm test`.
- [ ] Run `npm run test:policy-ingestion`.
- [ ] Run `npm run build`.
- [ ] Run local Supabase reset, lint, and pgTAP tests when the environment supports them; otherwise state that limitation explicitly.
- [ ] Review the full diff against all 22 findings and confirm no production action occurred.
- [ ] Open a non-draft PR to `main`, summarize each resolved finding and verification evidence, and explicitly prohibit hosted migration/deployment/merge without owner approval.
- [ ] Trigger `@coderabbitai review`, collect the new findings, and address any still-valid major regression before handoff.