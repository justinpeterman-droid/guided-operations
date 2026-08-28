# Testing strategy

The strategy favors fast deterministic tests near the code, real PostgreSQL and
browser tests for boundary behavior, and a small set of high-value end-to-end
and AI evaluations. All ordinary test fixtures are fictional. The only real
content allowed in qualification is the owner-approved policy/reference corpus
under the controls in
[fictional-data-and-rag-content.md](fictional-data-and-rag-content.md).

## Status and command contract

The command names below are target coverage contracts. They are not proof that
separate scripts or CI jobs currently exist. The repository currently groups
unit/component tests under npm test and also exposes npm run check, npm run
test:e2e, npm run db:test, and npm run test:eval; inspect package.json for the
current source of truth. The synthetic evaluation command runs in Web quality CI
with fictional passages and deterministic providers. The guarded authenticated
browser command also runs in its own CI lane against isolated local Supabase and
fictional qualification identities. Neither lane replaces the private
approved-corpus or later hosted qualification. As coverage matures, package
scripts and CI must use the same underlying commands so local and automated
results are comparable.

| Target           | Purpose                                                                                        |
| ---------------- | ---------------------------------------------------------------------------------------------- |
| lint             | static linting                                                                                 |
| typecheck        | TypeScript checking without emitting                                                           |
| test:unit        | pure domain and utility tests                                                                  |
| test:component   | isolated UI behavior                                                                           |
| test:integration | Next.js/server adapter and local Supabase integration                                          |
| test:db          | migrations, constraints, RLS, Auth, and Storage policy tests against local PostgreSQL/Supabase |
| test:e2e         | authenticated browser workflows                                                                |
| test:visual      | reviewed visual snapshots                                                                      |
| test:print       | print/PDF layout and content assertions                                                        |
| test:a11y        | automated accessibility checks                                                                 |
| test:eval        | synthetic AI/RAG evaluation                                                                    |
| build            | production build                                                                               |

CI must fail explicitly when a required target is absent. It must not silently
skip a lane because a service, browser, corpus, or credential is unavailable.

## Test pyramid

### 1. Unit tests

Run on each pull request and locally.

- schema-free domain rules, calculations, date/time boundaries, formatting, and
  redaction;
- input validation, error mapping, permission predicates, and stable error
  codes;
- prompt assembly using fictional text, citation formatting, chunk selection,
  provider-neutral AI response parsing, and refusal logic;
- idempotency-key derivation, retry/backoff rules, deterministic identifiers,
  and serialization;
- feature flags and environment validation without reading live secrets.

Unit tests do not prove RLS, SQL behavior, browser behavior, or provider
integration.

### 2. Component tests

Run on each pull request.

- loading, empty, unavailable, validation, retry, success, and permission-denied
  states;
- keyboard and focus behavior, error announcements, labels, headings, landmarks,
  and color-independent meaning;
- long fictional content, narrow/wide layouts, zoom, text scaling, reduced
  motion, and high contrast;
- citation/source panels, refusal states, stale-corpus warnings, and
  AI-provider-unavailable states;
- print controls and no-print elements.

Mock at a stable boundary rather than mocking component internals. Do not use
screenshots as the only assertion for behavior.

### 3. Integration and contract tests

Run against the local Supabase stack and real PostgreSQL, not SQLite or an
in-memory substitute.

- Next.js route/server-action input/output schema, authentication, CSRF/origin
  checks where applicable, and sanitized errors;
- browser-to-server and server-to-Supabase contracts;
- AI adapter request, timeout, retry, cancellation, budget, refusal, citation,
  and normalized-error contracts using a deterministic fake provider;
- private Storage upload/download/delete, MIME/size constraints,
  signed/authenticated access, and object metadata;
- corpus ingestion, checksum/version transitions, parsing failures, duplicate
  handling, and retrieval filtering;
- database migration from a clean database and from the previous release schema.

External provider contract checks must use a non-production account, smallest
safe request, no operational content, and an explicit cost cap. They are
scheduled or release-qualified, not required for every unit-test run.

### 4. End-to-end tests

Keep the suite small and centered on risk:

- unauthenticated visitor is redirected or denied;
- allowed fictional user signs in, refreshes a session, signs out, and cannot
  reuse a revoked/expired session;
- ordinary user cannot cross another fictional user's or role's boundary;
- policy search/question returns supported content with inspectable citations;
- unsupported question produces a useful refusal rather than invented guidance;
- private source document access obeys Storage policy;
- core fictional workflow survives refresh/retry without duplicate records;
- unavailable Supabase or AI provider produces an honest recoverable state;
- browser and print output contain required provenance/version information.

Run critical smoke tests on each preview and the fuller suite on the pinned
release candidate. Re-run an authenticated smoke against the exact production
deployment only after owner-authorized promotion.

The guarded `npm run test:e2e:local-auth` qualification command is restricted to
the fixed loopback Supabase ports and requires the exact local confirmation
flag. It resets only that disposable local database, provisions unmistakably
fictional administrator and officer accounts through the private lifecycle
functions, exercises private password sign-in plus officer report, incident,
Count Sheet, output, sign-out, and administrator workflows, and resets the local
database between roles and again after qualification. The Authenticated browser
quality workflow starts the fixed local Supabase stack before invoking this same
guarded command. It must never be pointed at Preview, staging, or Production and
is not a substitute for the later protected hosted-browser qualification.
State-changing authenticated specifications run once with one worker after a
fresh reset; CI retries are disabled for those specifications so a failure is
not hidden by retrying against already-mutated test state. On 2026-08-28 the
guarded lane passed at commit `49f6413` after completing public mobile/print,
officer Count Sheet, report/revision/Word-download, incident creation, sign-out,
and administrator workflows with fictional data. At commit `d821926` the same
lane also proved that an administrator disabling the fictional officer removes
that officer's already-authenticated access and rejects the old credential with
the generic sign-in failure (`33173353133`). At commit `571493c`, the guarded
lane additionally created a dedicated fictional timing-defense identity and
proved that known-wrong and unknown employee sign-ins return the same public
failure and no-store policy with no more than a 300 ms median response-time
difference in isolated local CI (`33176099890`). At commit `a045a43`, the same
lane signs one fictional officer into two separate browser contexts, performs
**Sign out everywhere** in the first, proves the second is immediately denied on
a protected page, and proves the credential can establish a fresh session
afterward. The database suite separately proves the two-phase authority changes
and bounded fail-closed token-hook behavior.

## PostgreSQL, RLS, Auth, and Storage matrix

Every protected table, view, RPC, and bucket needs an explicit matrix. At
minimum test:

`npm run db:lint` checks the application-owned `api`, `app_private`, and
`public` schemas and fails on warnings. The bundled `extensions` schema is
excluded because it contains provider-managed pgTAP helper functions used only
by the database test runner; those helpers are not application code.

| Actor/state                   | Expected checks                                                           |
| ----------------------------- | ------------------------------------------------------------------------- |
| Anonymous                     | no private row/object read, write, list, metadata, or signed-link minting |
| Authenticated ordinary user   | only intended one-facility scope and role operations                      |
| Different fictional user/role | cross-user and cross-role attempts denied                                 |
| Expired/revoked session       | denied even with a previously valid browser state                         |
| Server-side privileged client | only narrowly defined operations; never exposed to the browser            |
| Malformed/missing claims      | denied by default                                                         |

For each operation test SELECT, INSERT, UPDATE with old and new row visibility,
DELETE, RPC/function execution, and Storage object actions as applicable.

Database tests also cover:

- primary keys, foreign keys, unique/check/not-null constraints, cascades, and
  expected failure messages;
- indexes for foreign keys, common filters, RLS policy columns, and retrieval
  queries;
- grants on tables, sequences, functions, schemas, and default privileges;
- function search paths and invoker/definer behavior;
- transaction rollback, lock behavior, statement timeout, and migration
  idempotency;
- local reset from migrations with zero manual SQL.

RLS tests must query as actual roles/JWT claims. Tests performed only with a
Supabase secret/service role are invalid because that role bypasses RLS.

## Concurrency and idempotency

Any retryable or shared-state operation needs competing-request tests:

- same idempotency key submitted concurrently returns one logical result;
- different keys can proceed independently;
- unique constraints and an atomic upsert or short transaction prevent
  duplicates;
- stale update/version conflict is detected and explained;
- lock ordering is consistent and deadlocks are retried only when safe;
- partial AI/provider failure cannot leave a record falsely marked complete;
- repeated webhook/job/corpus-ingestion delivery has no extra side effect;
- browser double-click, refresh, timeout, and network retry are safe.

Tests should use barriers or controlled parallel clients rather than timing
sleeps. Assert final database state, response semantics, audit metadata, and
retry count.

## AI and RAG evaluations

Separate two suites:

1. **Synthetic CI suite (AUTOMATED):** fictional policies and deterministic
   fixtures; safe for repository and CI.
2. **Approved-corpus qualification (MANUAL/AUTOMATED + OWNER):** real
   policy/reference corpus in a private non-production environment; results
   remain access-controlled and content-free in ordinary CI artifacts.

The evaluation set includes:

- answerable questions with expected supporting document and section
  identifiers;
- unanswerable, ambiguous, conflicting, outdated, and out-of-scope questions;
- paraphrases, abbreviations, typographical errors, and long queries;
- prompt-injection text embedded in a source and in the user query;
- attempts to request secrets, hidden prompts, operational decisions, or content
  outside the approved corpus;
- missing/deleted document, changed effective date, new corpus version, and
  re-index failure;
- provider timeout, malformed output, rate limit, refusal, and model change.

Score and retain:

- retrieval success against expected document/section;
- citation validity and whether every material claim is supported;
- faithfulness to retrieved text without adding unsupported instructions;
- correct refusal/escalation behavior;
- stale/conflicting-policy disclosure;
- prompt-injection resistance;
- latency, token use, and estimated cost;
- reproducibility fields: commit, provider/model alias and version when
  available, prompt template, retrieval settings, and corpus manifest.

Hard production thresholds must be approved after a representative baseline.
Until then, any regression in citation validity, unsupported-claim rate, refusal
safety, or prompt-injection handling blocks promotion. A human reviewer must
inspect high-risk cases; a model may assist scoring but cannot be the only
release judge.

## Visual and print quality

Visual baselines are review gates, not files to regenerate until CI passes.

- Capture agreed desktop and mobile widths, light/dark modes if supported,
  zoom/text scaling, long content, empty/error/loading, and reduced-motion
  states.
- Review every changed snapshot and state why the change is intended.
- Use a clean isolated server and record viewport, browser, OS/font set, commit,
  and base URL.
- Do not accept a stale local server or HTTP 200 as visual proof; verify visible
  text, assets, route, and console errors.

Print/PDF checks cover:

- Letter and A4 page sizes where supported;
- no clipped text, overlapping content, stranded headings, or blank trailing
  pages;
- meaningful repeated header/footer, page numbers, generation time,
  policy/corpus version, and classification;
- citation URLs/identifiers remain readable;
- navigation, buttons, sensitive debug content, and backgrounds marked no-print
  are excluded;
- color is not required to understand status;
- browser print preview and generated PDF text extraction are both reviewed for
  critical forms.

## Accessibility

Automated checks are required but not sufficient. Test:

- keyboard-only navigation, visible focus, logical order, skip link, dialogs,
  menus, and escape behavior;
- semantic landmarks/headings, labels/instructions, names/roles/values, live
  errors, and status announcements;
- contrast, color-independent meaning, 200% text resize, 400% reflow, zoom, and
  target size;
- screen-reader flows for sign-in, policy search/question, citations,
  refusal/error, and print preparation;
- motion controls, timeout/session warnings, and error recovery.

The target is WCAG 2.2 AA unless the owner documents a stricter requirement.
Before pilot, include manual review with representative assistive technology and
resolve or explicitly owner-accept every known blocker.

## CI lanes and release execution

| Lane              | Trigger                                                            | Minimum evidence                                                                           |
| ----------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| Fast              | every PR                                                           | lint, typecheck, unit, component, secret/dependency scan                                   |
| Database          | every schema/auth/storage change and required PRs                  | clean migration, constraints, RLS/Auth/Storage matrix, concurrency/idempotency             |
| Browser           | every UI/auth/workflow change                                      | critical E2E, accessibility, console/network errors                                        |
| Visual/print      | affected changes                                                   | reviewed snapshots and print artifacts                                                     |
| AI synthetic      | retrieval/prompt/provider/corpus-pipeline changes and required PRs | deterministic eval report                                                                  |
| Release candidate | pinned commit                                                      | all applicable lanes, non-production deploy, approved-corpus eval, backup/restore evidence |
| Post-deploy       | owner-authorized production promotion                              | authenticated fictional smoke, version checks, monitoring and rollback readiness           |

Required checks must be branch-protected when CI exists. Release evidence
identifies the exact commit, build/deployment ID, migration set, environment,
corpus manifest, and reviewer.

## Flaky tests and failures

- A failed required test blocks the lane.
- Retry only to collect evidence, not to turn red into green. Record the first
  failure.
- Quarantine requires an owner, issue, risk statement, expiry date, and
  replacement coverage; security/auth/RLS/corpus-safety tests cannot be waived
  silently.
- Never weaken assertions, mass-update snapshots, disable browser errors, or use
  privileged database credentials merely to pass CI.
- External-provider unavailability is an **EXTERNAL** blocked gate, not a
  passing result.
