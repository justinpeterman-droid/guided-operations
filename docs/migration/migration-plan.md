# Replacement Migration Plan

> **Current release boundary:** a personal, non-commercial hobby app for a small
> invited group of officers, with fictional operational data. References to an
> official facility pilot, real-data use, or organizational production below are
> future gates and are not authorized by this plan.

## Status and objective

**Status at baseline:** planning. The Next.js/Supabase scaffold, liveness route,
initial private-schema migration/tests, Count Sheet calculation/schema slice,
and policy grounding schema are **FOUNDATION**. They do not form a complete
user-facing feature. Product migration, hosted Supabase/Vercel production
configuration, corpus transfer, cutover, and Google Cloud retirement are
**MIGRATION-BACKLOG**.

Objective: deliver a private, single-facility, web-only Guided Operations
replacement on Vercel and Supabase, preserve the accepted React product behavior
and safety rules, add the branch-only full-policy reader in the target
architecture, validate with fictional operational data and authorized policy
sources, cut over controllably, and eliminate all Google Cloud runtime/storage
dependencies.

## Fixed decisions

- Repository: private `guided-operations`.
- Web application only; omit legacy desktop/Access handoff.
- Next.js as the React framework.
- Vercel application/server runtime.
- Supabase Postgres, identity support, private storage, and vector retrieval.
- One configured facility; no facility picker or multi-tenant control plane in
  the first release.
- Employee number plus PIN-like sign-in experience.
- Officer and administrator interactive roles.
- No real operational/personnel data under the current build/validation
  authorization.
- Existing authorized policy/RAG material is the only permitted real content.
- United States region assumption, to be verified for every
  service/subprocessor.
- OpenAI is acceptable initially; AI interfaces remain provider-neutral.
- Vercel Hobby and Supabase Free are the starting candidates while the exact
  personal, non-commercial use fits their terms and measured limits.
- End state has no Google hosting, database, storage, retrieval, AI, queue,
  monitoring, or deployment dependency.

## Planning rules

1. Migrate behavior and safety contracts, not legacy infrastructure.
2. Pin every legacy-derived change to the source commit/path in the
   [Source Manifest](source-manifest.md).
3. Create the target data and authorization contract before wiring copied UI to
   data.
4. Use server-only boundaries for credentials, sensitive mutations, AI, storage
   signing, and document generation.
5. Apply RLS and least-privilege grants even when the current records are
   fictional.
6. Treat preview, staging, production, migration, pilot, and retirement as
   separate gates.
7. Keep old Google resources intact until corpus recovery, rollback, and owner
   approval are complete.
8. Never solve a migration blocker by importing real operational fixtures or
   weakening authentication/authorization.

## Target environment model

| Environment  | Vercel                               | Supabase                                                                                                                                                | Data rule                                                                           | Purpose                                                                     |
| ------------ | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Local        | Local Next.js runtime                | Local Supabase CLI stack when practical                                                                                                                 | Fictional data; synthetic/non-sensitive RAG fixture only                            | Fast development, schema/RLS tests, offline-safe UI work                    |
| Preview      | Per-pull-request Vercel preview      | Isolated preview database/project/branch if available, otherwise a tightly scoped shared non-production project with per-preview namespaces and cleanup | Fictional data only; no real corpus by default                                      | Review, browser tests, accessibility, visual approval                       |
| Test/staging | Stable Vercel environment            | Separate non-production Supabase project                                                                                                                | Fictional operations; authorized test subset of corpus only after rights approval   | Migration rehearsal, restore, integration, load, print, provider validation |
| Production   | Vercel Production environment/domain | Separate live Supabase project in an approved US region                                                                                                 | Owner-authorized real operations and corpus after release gates; two-year retention | Private invited-officer production release                                  |

Never connect a pull-request preview to the production database or production
storage bucket. Environment secrets, webhook targets, auth redirect URLs, cookie
domains, storage buckets, provider projects, and rate-limit namespaces must be
distinct.

## Workstreams

| Workstream         | Primary outputs                                                                      | Depends on                           |
| ------------------ | ------------------------------------------------------------------------------------ | ------------------------------------ |
| Product/domain     | Terms, workflows, role matrix, parity, safety invariants, owner decisions            | Fixed decisions                      |
| Repository/CI      | Branch protection, checks, ownership, dependency policy, fictional-data/secret scans | Product baseline                     |
| Vercel             | Projects/environments, domains, server/runtime settings, logs, protection, rollback  | Repository/CI                        |
| Supabase           | Projects, migrations, RLS/grants, Auth adapter, Storage, backups, observability      | Domain/authorization model           |
| Identity           | Employee-number mapping, PIN policy, sessions, step-up, bootstrap/reset              | Supabase + security decisions        |
| Incidents/reports  | Versioned domain, six-step workflow, jobs, Document Studio, outputs                  | Identity + core schema               |
| Forms/paperwork    | Approved definitions, rendering, print, Count, Daily/Monthly                         | Core schema + source-owner decisions |
| Policy/RAG         | Corpus recovery, rights, storage, page/chunk/embedding, retrieval, citations, reader | Supabase + provider + corpus owners  |
| Administration     | Overview/incidents/accounts/audit/health/paperwork oversight                         | All relevant domain services         |
| Quality/security   | Unit/integration/browser/RLS/accessibility/print/load/restore/recovery evidence      | Continuous across workstreams        |
| Cutover/retirement | Domain traffic, monitoring, rollback, exports, Google deletion                       | All release gates                    |

## Phase 0 — Decisions, ownership, and discovery

### Deliverables

- Approve this product contract, roles, safety invariants, parity scope, and
  omitted legacy Review Lab handoff.
- Name product, security, database, corpus, policy QA, accessibility,
  records/print, release, and retirement owners.
- Resolve the open authentication/session decisions in
  `docs/product/roles-and-permissions.md`.
- Inventory current Google services, domains, DNS, jobs, storage, database,
  secrets, indexes, AI providers, monitoring, budgets, and Terraform state
  without changing them.
- Locate authoritative bytes for all 292 legacy corpus names and identify extra
  provider objects.
- Create data-classification and rights review templates.
- Decide supported browsers, devices, printers/PDF paths, and accessibility test
  tools.
- Record expected user count, concurrent users, corpus size, query volume,
  artifact volume, retention, RTO, and RPO. These determine whether free plans
  are viable.

### Exit gate

- No material owner is unnamed.
- Every unresolved decision has an owner/date and does not block Phase 1.
- Corpus source recovery has a credible path; missing bytes are recorded as
  blockers.
- GCP inventory and dependency graph are stored in a controlled location.
- No real operational-data migration is planned under the current authorization.

## Phase 1 — Repository and delivery foundation

### Deliverables

- Protect `main`; require reviewed pull requests and status checks.
- Add CODEOWNERS/ownership for auth, migrations/RLS, RAG, documents, and
  deployment when owners are known.
- Lock Node/package-manager versions and deterministic installs.
- Establish lint, TypeScript, unit/component, migration, RLS, build, and
  browser-smoke jobs.
- Add dependency, secret, generated-artifact, binary, and fictional-data
  scanning.
- Configure Dependabot/Renovate or equivalent with review requirements; no
  unattended major production upgrades.
- Define environment-variable schema with server-only/client-safe separation and
  startup validation.
- Add architecture decisions for Next.js route/server boundaries, Supabase
  access, jobs, document generation, and AI provider interfaces.
- Add pull-request template fields for source provenance, data classification,
  migrations, rollback, screenshots, accessibility, and deployment impact.

### Exit gate

- A clean clone installs and runs the default checks deterministically.
- Client bundles and build logs contain no server credentials.
- A sample rejected migration/RLS test proves the gate can fail.
- Preview deploy uses fictional data and cannot reach production Supabase.
- The root app may still be a shell; this phase does not claim product parity.

## Phase 2 — Supabase and Vercel non-production foundation

### Supabase deliverables

- Create separate non-production and production projects in approved US regions;
  record project ownership and break-glass access privately.
- Enable required extensions only after review (for example `vector`; use
  time-ordered opaque IDs only when supported and needed).
- Define migrations for facility configuration, staff profiles, web
  accounts/identity mappings, sessions metadata, audit events, idempotency, and
  migration bookkeeping.
- Revoke broad default privileges; grant only required
  schema/table/sequence/function access.
- Enable/force RLS where appropriate and create negative tests.
- Index all foreign keys and RLS/filter columns; use composite indexes matching
  actual equality/range query patterns.
- Create private storage buckets and deny public listing/reads.
- Configure backup/restore, connection pooling, limits/timeouts, log
  retention/redaction, and alert ownership.
- Create fictional seeds that are deterministic, obviously fake, and excluded
  from production unless explicitly used for smoke then removed.

### Vercel deliverables

- Create protected project/environment separation and approved US execution
  regions where configurable.
- Configure environment variables by scope; sensitive values are server-only and
  rotated after setup validation.
- Configure preview access protection, production domain ownership, secure
  headers, cache rules, error/log integrations, and deployment retention.
- Set runtime duration/body/output limits based on measured report generation
  and RAG calls.
- Keep long-running ingestion outside interactive requests; select a
  Supabase-native or other approved non-Google job mechanism after measuring
  requirements.
- Define exact deployment promotion and rollback steps.

### Exit gate

- Local/test schema applies from zero and from the prior revision.
- Migration checks prove constraints, grants, RLS, and required indexes.
- Direct anonymous/officer cross-row and storage enumeration attempts fail.
- A backup is restored into an isolated environment and reconciled.
- Vercel preview and production configuration cannot accidentally share
  database/storage/provider credentials.
- Free-tier limit review is recorded; any production gap has an approved
  paid-tier plan or architecture change.

## Phase 3 — Identity, session, audit, and shared domain foundation

### Deliverables

- Implement the employee-number/PIN-like identity adapter with normalization,
  protected credential handling, throttling, lockout/backoff, temporary
  credentials, and generic failures.
- Implement server-verified sessions, secure cookies, session
  rotation/revocation, timeout policy, and CSRF protection appropriate to the
  chosen mutation model.
- Implement officer/admin roles, active state, step-up, and role-change/session
  invalidation.
- Separate staff profiles from accounts and preserve historical attribution.
- Implement redacted audit events, correlation IDs, structured safe errors, and
  shared persistence-status vocabulary.
- Implement idempotency store and base-revision conflict primitives.
- Add one configured facility boundary without exposing a facility selector.
  Carry facility scope in protected rows/policies when it materially prevents
  global-row mistakes and eases future isolation; do not build multi-tenant
  administration.
- Establish typed domain schemas and error envelopes used by both server and
  client.

### Exit gate

- Authentication abuse, reset, deactivation, session, step-up, and direct-access
  tests pass.
- Client cannot choose actor/role/facility scope.
- RLS and server checks agree for positive and negative cases.
- Audit-redaction tests prove prohibited bodies/secrets are absent.
- Two-client revision/idempotency test harness is working before feature data is
  built on it.

## Phase 4 — Application shell, Home, Help, and Account

### Deliverables

- Build Next.js authenticated layouts and route boundaries; no `/workspace`
  basename.
- Port/adapt the accepted tokens, primitives, accessible icons, persistence
  language, responsive nav, and Home-only fictional scenic assets after rights
  review.
- Implement sign-in, sign-out/session-expired behavior, officer Home, Help,
  Account, PIN change, and own-session revoke.
- Home reads authorized server data and has loading, empty, error, retry, and
  no-work states.
- Add browser tests for desktop/mobile, keyboard/focus, zoom/reflow, reduced
  motion, forced colors, session expiry, and no console/asset errors.

### Exit gate

- The deployed preview shows the intended app—not a scaffold—and all visible
  data is authorized fictional data.
- Direct protected-route access redirects/denies correctly on the server.
- Home never fabricates work or service state.
- Manual design/accessibility review accepts the shared shell before it
  multiplies across features.

## Phase 5 — Incidents, reports, and Document Studio

### Domain deliverables

- Versioned incident, people/role relationships, source notes, proposed facts,
  confirmations, gap questions/answers, reports, packet items, document actions,
  and histories.
- Approved controlled incident categories and versioned checklist/rule
  definitions.
- State transitions enforced on the server; officer progress calculated from
  durable state; admin record state separate.
- Generation job contract with immutable input revision,
  prompt/template/provider versions, idempotency, bounded retries, and
  stale-result rejection.
- Provider-neutral extraction/generation adapters and strict schemas.

### UI deliverables

- Six-step New Report with reload/resume, full officer relationships,
  source-backed questions, and complete save/conflict states.
- Authorized Reports list.
- Document Studio with all six tabs, editable/reporting attribution, history,
  copy-only outputs, packet grouping, and deliberate actions.
- Admin incident list/workspace may begin here or Phase 8, but shared domain
  authorization must not be deferred.

### Exit gate

- Tests prove raw/proposed facts cannot reach output as confirmed facts.
- Regeneration preserves human edits/history.
- Two-client conflicts preserve both visible inputs and prevent overwrite.
- Job retry produces one logical result and cannot attach to a superseded
  revision.
- Officer and admin cross-access/attribution tests pass.
- No real operational data is used in provider requests or evidence.

## Phase 6 — Forms, Count Sheet, and routine paperwork

### Deliverables

- Review and import approved form/checklist definitions with source, revision,
  rights, capabilities, and rule versions.
- Implement real template/render pipelines for each advertised
  browser/print/PDF/Word capability.
- Preserve physical-only guidance with no digital substitute.
- Complete Forms Library and add-to-incident flow.
- Complete NCU Days Count entry, reconciliation, persistence, history, and
  landscape print.
- Complete all six Daily Paperwork editors/prints with revision-safe autosave.
- Complete four Monthly Paperwork templates after deciding print-only vs.
  persisted edit contracts.
- Keep Weekly Paperwork honestly unconfigured until approved templates exist.
- Store generated artifacts privately with immutable provenance and retention
  class.

### Exit gate

- Source/rights/records owner accepts every advertised form and output format.
- Blank-vs-zero, field order, pagination, font, barcode/identifier if any, and
  printer/PDF results pass.
- Physical-only outputs have no generated substitute route/action.
- Artifact authorization, expiry, hash/provenance, duplicate-request, and
  cleanup tests pass.
- Mobile/keyboard/zoom and print accessibility checks pass for representative
  complex forms.

## Phase 7 — Policy corpus, retrieval, citations, and reader

Execute [RAG Corpus Migration](rag-corpus-migration.md) stages R0–R7.

### Deliverables

- Reconciled legacy inventory and authoritative source bytes.
- Rights-reviewed private content-addressed storage.
- Corpus registry, reproducible page-aware extraction/OCR, chunks,
  full-text/vector indexes, and accepted ingestion run.
- Provider-neutral retrieval/answer adapters, strict citation verifier,
  no-answer path, and bounded observability.
- Policy Expert UI and authorized Full Policy Reader.
- Shadow comparison using approved non-sensitive regression questions.
- Backup/restore and active-ingestion-run rollback.

### Exit gate

- Corpus hash/object/page/chunk reconciliation passes.
- Rights status allows each active processing/display path.
- Citation precision/page accuracy and no-answer thresholds pass the
  pre-approved evaluation.
- Unauthorized source, guessed ID, injection, citation tamper, provider failure,
  and source quarantine tests pass.
- No Google retrieval/AI call occurs in the target candidate, while the old
  provider remains available only as a controlled rollback reference until
  retirement.

## Phase 8 — Administration and operational visibility

### Deliverables

- Admin entry/step-up and responsive layout.
- Overview with trustworthy dependency-backed summaries.
- Facility incident oversight and controlled state transitions.
- Paperwork Center Daily/Weekly/Monthly behavior.
- Accounts & Staff with temporary credential, role/account state, and session
  controls.
- Redacted, paginated Audit.
- System Health for Vercel, Supabase, storage, RAG/provider, and job
  dependencies.
- Omit the legacy Review Lab/Access handoff. Open a separate product decision if
  a browser-native replacement is needed.

### Exit gate

- Direct officer-to-admin route/API/storage access fails.
- Expired step-up, role downgrade, duplicate transition, stale incident, and
  inactive-account cases pass.
- Counts/health never imply a dependency state without a trustworthy
  source/time.
- Audit and health contain no protected bodies, provider secrets, object keys,
  or signed URLs.

## Phase 9 — Release qualification

### Automated evidence

- Clean install, lint, TypeScript, unit/component tests, production build.
- Database migration from zero and prior revision; constraints/index/grant/RLS
  tests.
- Domain integration tests with Supabase and provider contract fixtures.
- Full officer/admin E2E suite using fictional data.
- Direct-authorization and storage-policy suite.
- Accessibility semantics/contrast/focus/reflow/reduced-motion suite.
- Visual review snapshots at representative desktop, Windows scaling/zoom,
  tablet, mobile, and print sizes.
- Production-bundle/preview smoke with real session cookies and no browser
  console/asset failures.
- RAG evaluation, load/failure, backup/restore, and rollback rehearsal.
- Secret, dependency, binary, generated-artifact, and fictional-data scans.

### Manual evidence

- Product-owner parity walkthrough.
- Keyboard and manual screen-reader review.
- Physical Windows high contrast/display scaling/on-screen keyboard.
- Printer and PDF-driver acceptance for each official output class.
- Corpus/page/citation policy-owner review.
- Security/privacy/rights review.
- Measured p75/p95 browser/server/RAG performance and capacity/cost review.
- Runbook tabletop plus executed rollback rehearsal.

### Exit gate

Record exact commit, Vercel deployment, Supabase project/migration revision,
corpus ingestion run, provider/model configuration, test artifacts, reviewers,
open limitations, and explicit release approval. Repository green, deployment
successful, and pilot approved remain separate fields.

## Phase 10 — Pilot, cutover, and retirement

Follow [Cutover, Retirement, and Rollback](cutover-retirement-rollback.md).

Current authorization permits real operational/personal data only in isolated
Production after release gates. Qualification exercises authentication and
workflows with fictional records plus the authorized corpus. It is not an
official pilot and does not authorize real incident/personnel data.

After target traffic and corpus behavior are accepted, close the defined
rollback window and retire Google resources in dependency order. Data-bearing
deletion is a separate explicit owner action.

## Definition of done per work item

Every implementation issue/pull request should include:

- product requirement and `SAFE-*` invariants affected;
- legacy commit/path and reuse decision, if derived;
- domain/API/schema/RLS/storage changes;
- expected authorization and negative cases;
- idempotency/revision behavior;
- loading/empty/error/recovery behavior;
- data classification and log/audit fields;
- provider/server/client boundary;
- unit/integration/browser/accessibility/print evidence as applicable;
- migration and rollback impact;
- screenshots only with fictional data;
- remaining gaps, with no “complete” claim beyond the tested scope.

## Initial backlog ordering

Use vertical slices after the shared foundation. A recommended order is:

1. Fictional account sign-in → authenticated shell → Account sign-out/session.
2. Home authorized empty/error states → fictional summary.
3. Incident create → save notes → reload → revision conflict.
4. Proposed facts → confirmation → missing-information rules.
5. One officer report type end-to-end with generation provider fixture → review
   → history.
6. One approved digital form plus one physical-only form → packet → deliberate
   action.
7. Reports list and full Document Studio.
8. Count Sheet.
9. Daily then Monthly Paperwork; Weekly remains empty.
10. Minimal approved corpus subset → retrieval → strict citation → reader.
11. Full corpus ingestion/evaluation.
12. Admin slices: incident oversight, paperwork, accounts, audit, health.
13. Full qualification and cutover.

This ordering proves the hardest safety boundaries early without pretending one
thin slice is full parity.

## Risk register

| Risk                                            | Early signal                                       | Mitigation / stop rule                                                                                                            |
| ----------------------------------------------- | -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Corpus source bytes unavailable                 | Manifest name has no provider object/export        | Stop that source; do not reconstruct from embeddings; resolve with source custodian before retirement.                            |
| Rights do not allow OpenAI/Supabase processing  | Rights status pending/restricted                   | Exclude source or select an approved processing path; never upload first and review later.                                        |
| PIN-like credential is brute-forceable          | High failures, weak policy, identifier discovery   | Server hashing/provider protection, multi-signal rate limits, backoff/lockout, generic errors, monitoring, owner-approved policy. |
| RLS is incomplete or slow                       | Direct API sees cross-row data or queries time out | Deny by default, force/test RLS, index predicate columns, least privilege, query-plan/load tests.                                 |
| Copied React UI becomes client-only monolith    | Secrets/data mutations move into client components | Define server/domain boundaries first; adapt components incrementally.                                                            |
| Vercel request limits break generation          | Timeouts/large artifacts                           | Measure early; use bounded async job/outbox/worker design on approved non-Google services; keep inputs idempotent.                |
| Free tiers pause, throttle, or lack recovery    | Quotas/backup needs exceed plan                    | Use free tiers only where evidence supports them; accept the limits or upgrade before the live app depends on them.               |
| Form rendering looks complete but is inaccurate | Generic preview passes UI tests only               | Source-owner mapping, real format generation, pixel/print/content comparison, records-owner acceptance.                           |
| Citation appears plausible but is unsupported   | Title/excerpt shown without page/span validation   | Strict server verification; fail closed; evaluation includes tamper/no-answer cases.                                              |
| Autosave overwrites work                        | Two clients save same base revision                | Base revision, idempotency, short transactions, typed conflict, visible-work recovery.                                            |
| Old readiness claims are reused                 | PR cites old green check/screenshot                | Require new commit/environment evidence for every target gate.                                                                    |
| Google resources deleted too soon               | New backup/reader/rollback not proven              | Retirement checklist blocks deletion; data-bearing services last; explicit retirement-owner approval.                             |

## Progress reporting template

Report phase status with evidence, not percentage alone:

```text
Phase:
State: not started | in progress | blocked | accepted
Exact commit/deployment/migration/corpus run:
Completed acceptance gates:
Evidence links/artifacts:
Known gaps:
Blocker owner and next decision date:
Real-data authorization: Production-only after exact release approval
Deployment state:
Migration state:
Pilot state:
Retirement state:
```
