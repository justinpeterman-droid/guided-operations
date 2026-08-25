# Guided Operations delivery roadmap

This roadmap is ordered by risk and dependency, not by visual prominence. A
phase is complete only when its exit evidence is recorded; a merge or green CI
run does not satisfy external approval gates.

## Phase 0 — replacement foundation

Status: **in progress**

- Create the private replacement repository.
- Establish Next.js, TypeScript, testing, CI, Supabase local configuration, and
  AI-agent instructions.
- Record the canonical predecessor SHA and branch reconciliation.
- Write product, architecture, security, migration, quality, and operations
  sources of truth.
- Port one deterministic feature slice with its tests to prove the migration
  method.

Exit: clean checks, reviewed documents, no secrets or real operational data, and
owner agreement on the open ADRs.

## Phase 1 — cloud development environment and identity

Status: **blocked on owner authentication and final auth ADR**

- Authenticate Vercel and Supabase CLIs without storing tokens in Git.
- Create aligned U.S.-region development projects. Vercel Hobby and Supabase
  Free are the starting candidates for the confirmed personal, non-commercial,
  non-operational use, subject to current terms and quotas.
- Link GitHub to Vercel and configure scoped development/preview secrets.
- Apply and test the private-schema foundation migration.
- Implement employee-number plus personal-passcode authentication, account
  lifecycle, generic errors, throttling, lockout, secure cookies, revocation,
  admin elevation, and protected bootstrap/reset ceremonies.

Exit: auth threat-model review, positive and negative authorization tests,
restore proof, and an authenticated fictional-data preview.

## Phase 2 — incident and report core

Status: **planned**

- Port incident identity, officer/preparer selection, field notes, deterministic
  fact review, generated missing-information checks, report drafts, revisions,
  history, ownership/access, concurrency, idempotency, and DOCX export.
- Preserve the old web API only as a behavior inventory; generate one complete
  new contract from the replacement implementation.

Exit: PostgreSQL integration tests, report-safety golden cases, deterministic
export checks, keyboard/a11y review, and owner workflow acceptance.

## Phase 3 — forms and operational paperwork

Status: **planned**

- Port Daily Paperwork and Count Sheet storage/UI/print flows.
- Port the approved Monthly packet catalog.
- Complete Forms Library selection, paper-accurate preview, eligible download,
  editable digital-form controls, N/A workflow, and packet actions.
- Keep Chain of Custody and any other physical-only workflow explicitly
  physical.

Exit: revision/concurrency tests, print comparisons, fictional-data Playwright
flows, and records-owner approval of every output.

## Phase 4 — policy corpus and grounded assistance

Status: **blocked on corpus inventory and rights classification**

- Export and reconcile every original source, OCR derivative, chunk, version,
  hash, page map, and citation from the old RAG system.
- Import approved source objects into private Supabase Storage.
- Build full-text and vector indexes using versioned provider adapters.
- Port Policy Expert and implement the archived full-policy reader behavior in
  Next.js, including allowlisted IDs, bounded passages, original-PDF fallback,
  passage highlighting, and accessible focus restoration.
- Evaluate citations, abstention, prompt-injection resistance, and invented-fact
  rejection before enabling generation.

Exit: corpus reconciliation equals the approved manifest, citation golden set
passes, access controls pass, and the source owner signs off.

## Phase 5 — administration and durable work

Status: **planned**

- Port accounts/staff administration, audit log, incident administration,
  paperwork command center, system health, and bounded notifications.
- Introduce Supabase Queues and a non-Google worker only for measured jobs that
  cannot safely complete within request limits.
- Qualify retries, leases, stale-revision rejection, poison-message handling,
  idempotency, and dead-letter operations.

Exit: administrative step-up tests, queue recovery exercise, redacted telemetry,
and on-call runbook exercise.

## Phase 6 — private hobby release and RAG cutover

Status: **planned**

- Complete security, corpus rights, retention, backup/restore, accessibility,
  performance, and cost checks appropriate to the private hobby release.
- Run a fictional-data rehearsal, then a time-boxed evaluation with the invited
  officers. This is not an official facility pilot and cannot use real
  operational data.
- Freeze old ingestion, perform final corpus reconciliation, verify the new
  environment, change traffic, and retain a tested rollback window.
- Retire Google Cloud only after data and object exports, restore proof, audit
  retention, billing review, and owner approval.

Exit: owner-approved private hobby release and documented closure of rollback
and legacy-retirement gates. Official organizational adoption remains a new,
separately approved project phase.
