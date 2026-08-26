# Production execution checklist

**Goal:** Move Guided Operations from the verified no-data foundation to a live,
owner-authorized private hobby release by completing the gated sequence in
[`ROADMAP.md`](../../ROADMAP.md).

**Started:** 2026-08-25  
**Working branch:** `codex/production-readiness`  
**Data boundary:** fictional operational/personnel data only; approved real
policy/reference content only after corpus authorization  
**Live target:** Vercel plus a separate live Supabase project in an approved
United States region

This is the operational tracker, not a competing plan. `ROADMAP.md` owns phase
order and exit criteria. The product, architecture, security, ADR, migration,
quality, and operations documents remain authoritative for behavior and safety.

## Evidence rule

A checkbox may be marked complete only when the evidence identifies the exact
commit/environment and the applicable command, CI run, deployment, browser
observation, migration, backup, restore, review, or owner decision. A planned
feature, passing unit test, provider dashboard state, or HTTP 200 is not enough
to mark a release gate complete.

## Standing working authority and pause conditions

Proceed without asking again for routine, reversible work inside this boundary:

- repository branches, commits, pull requests, issue tracking, CI, tests, and
  documentation;
- local implementation and local ephemeral Supabase resets using fictional
  fixtures;
- protected Preview configuration and non-production provider checks;
- additive, reviewed non-production migrations after local/CI replay;
- fictional qualification accounts and data that are uniquely owned and safely
  removable;
- production qualification and promotion only after every applicable release
  gate passes and the exact candidate is recorded.

Pause and report a blocker instead of guessing when work requires:

- payment, a plan purchase, or acceptance of materially different provider
  terms;
- an interactive owner login that cannot be completed with existing provider
  credentials/connectors;
- real employee, roster, resident, incident, report, or operational data;
- policy corpus rights, authoritative-version, custodian, or external-AI
  approval that has not been supplied;
- weakening authentication, authorization, backups, privacy, or release gates;
- destructive production data changes, DNS cutover outside the recorded target,
  or Google/legacy retirement without separate destructive authorization.

## Phase 0 — foundation closure and repository controls

- [x] Private `guided-operations` repository exists.
- [x] Next.js/TypeScript foundation, Supabase local configuration, CI, and agent
      contract exist.
- [x] Canonical predecessor commit and migration manifest are recorded.
- [x] Count Sheet deterministic domain slice and tests are ported.
- [x] Product, architecture, security, migration, quality, and operations
      contracts exist.
- [x] Detailed production roadmap and owner-decision ledger exist.
- [x] Individual passcode minimum and initial account-authority decisions are
      recorded.
- [x] Web and database GitHub workflows passed on the current foundation.
- [x] Local web quality gate and foundation Chromium smoke passed on 2026-08-25.
- [x] Start Docker Desktop and replay `db:start`, `db:reset`, `db:lint`, and
      `db:test` locally against the current branch.
- [x] Record local migration head `20260825125137`; schema lint passed and all
      24 pgTAP tests passed on 2026-08-25.
- [x] Add automated tracked-secret scanning and high-severity production
      dependency review.
- [ ] Review Dependabot updates individually.
- [ ] Confirm no secret, real operational data, restricted corpus content,
      provider metadata, or generated build output is tracked.
- [ ] Record the temporary manual repository controls necessitated by the
      current private-repository plan: pull request, green checks, review,
      no-force-push, and release record.
- [x] Open a narrow pull request for Phase 0/1 foundation work: PR #1.
- [x] Confirm exact-commit Web quality CI is green for `9c6248f`; no review or
      inline comments were present at the 2026-08-25 check.

### Phase 0 exit

- [x] Full web and local database gates pass on the Phase 0 content; GitHub Web
      quality is green for `9c6248f` and the local reset/lint/pgTAP replay has
      no database-source delta.
- [ ] Documentation and hosted state agree.
- [x] Security/dependency scanning is active in Web quality CI.
- [ ] Repository-control path is recorded.

## Phase 1 — connected non-production environment

- [x] Supabase Development/Preview foundation project exists in `us-east-1`.
- [x] Foundation migration is applied with empty forced-RLS tables and private
      buckets.
- [x] Git-connected authoritative Vercel project exists.
- [x] Authoritative foundation is live at `https://guided-operations.vercel.app`
      with disabled sign-in.
- [x] Live foundation homepage and `/api/health/live` were browser/HTTP
      verified.
- [ ] Confirm `iad1` function region in code/provider configuration.
- [ ] Confirm the authoritative Vercel project contains only correctly scoped
      public Preview/Production values.
- [ ] Confirm the secondary non-authoritative Vercel project cannot receive
      production traffic or secrets.
- [x] Verify public signup, manual linking, anonymous sign-in, email
      confirmation, Site URL, and redirect allow-list in Development Supabase.
      Hosted Supabase has no separate recovery-disable toggle while
      email/password sign-in remains enabled; application recovery remains
      prohibited pending the approved private reset ceremony.
- [x] Add `APP_ENV` and exact `APP_ORIGIN` validation; unit tests reject paths,
      queries, and fragments (`291cc5d`).
- [x] Add `/api/health/ready` without exposing provider details; it returns only
      service readiness and maps invalid/unavailable configuration to `503`
      (`291cc5d`).
- [x] Verify readiness locally and in a protected Preview (`94dfd61`,
      `dpl_EkjZg7P2BqZ1CD8Q5Aqner6CtuKJ`).
- [ ] Inspect desktop/mobile Preview text, assets, console, network, headers,
      focus, and protection boundaries.

### Phase 1 exit

- [x] Protected Preview deployment ID maps to the reviewed commit.
- [x] Preview points only to non-production Supabase services.
- [x] Hosted page, liveness, readiness, and protection are independently
      verified.

## Phase 2 — identity, sessions, authorization, and bootstrap

- [x] Minimum eight-character individual-passcode rule is recorded.
- [x] Common-pattern and employee-number-equality rejection is required.
- [x] Owner is recorded as first/main administrator and sole initial account
      lifecycle authority.
- [x] Admin MFA is explicitly deferred only for the no-data hobby boundary.
- [ ] Define employee-number normalization and allowed passcode alphabet.
- [x] Add a tested, provider-neutral minimum-passcode/common-pattern/employee-
      equality policy primitive without prematurely deciding the final
      identifier format or creating hosted accounts (`ab66239`).
- [x] Build disposable hosted alias-bridge spike: a generated non-deliverable
      alias issued a password session through server-side provisioning, and
      known-wrong/unknown aliases returned the same provider failure status; the
      temporary account was deleted. See ADR-0003 (2026-08-25).
- [ ] Prove the internal alias is absent from UI, APIs, redirects, recovery,
      email, logs, analytics, cookies, and browser storage.
- [ ] Threat-model enumeration, timing, lockout denial, credential stuffing,
      token theft, Auth-admin key misuse, bootstrap, reset, role changes, and
      last-admin safety.
- [ ] Accept ADR-0003 or replace it without weakening the credential boundary.
- [ ] Add forward identity/account/rate-limit/audit migrations.
- [ ] Add generated database types and drift check.
- [ ] Add least-privilege routine and administrative server clients.
- [ ] Implement sign-in with generic failures and layered throttling/lockout.
- [ ] Implement Secure/HttpOnly/SameSite session cookies and safe redirects.
- [ ] Implement refresh rotation, expiry, logout, logout-all, forced temporary
      passcode change, reset revocation, and disabled-account behavior.
- [ ] Implement CSRF/origin checks and authenticated `no-store` behavior.
- [ ] Implement server authorization plus operation-specific RLS/Storage rules.
- [ ] Implement protected first-admin bootstrap with generated temporary secret,
      single-use delivery, idempotency, forced change, and audit redaction.
- [x] Add a local-only, zero-account database bootstrap ceremony: transaction
      lock, pending administrator, forced expiring temporary credential state,
      private-delivery activation, failed-delivery cleanup, and allowlisted
      audit outcomes. The ceremony is not exposed to a browser route and has not
      been run with a real identity.
- [ ] Implement account create, deactivate, role change, reset, and unlock with
      purpose-bound admin step-up.
- [ ] Pass known/unknown employee timing and enumeration tests.
- [ ] Pass direct database
      anonymous/authenticated/cross-user/cross-role/disabled and elevated-key
      negative tests.
- [ ] Pass real-browser login/session/revocation/bootstrap tests with fictional
      qualification identities.

### Phase 2 exit

- [ ] ADR-0003 is Accepted with spike and threat-model evidence.
- [ ] Auth, session, lifecycle, server authorization, RLS, Storage, and
      bootstrap positive/negative evidence is complete.
- [ ] Protected Preview supports fictional officer/admin identities without
      alias leakage or cross-account access.

## Phase 3 — incident and report vertical slice

- [ ] Freeze the first parity slice and record omissions.
- [x] Define versioned Zod/domain contracts for fictional incident revisions,
      confirmed-fact provenance, explicit unknown/not-applicable states, and
      report-draft references that exclude unreviewed narrative (`45f0c0b`).
- [ ] Add incident, fact, draft, revision, export, audit, and idempotency
      schema.
- [x] Add the initial default-deny incident/report foundation: incident and
      report heads, immutable revisions, report access relationships, indexes,
      forced RLS, revoked direct grants, and pgTAP checks (`25ad616`; local
      replay/lint/30 pgTAP and GitHub Database quality passed).
- [ ] Add constraints, indexes, grants, forced RLS, and append-only protections.
- [ ] Implement server-only reads and authorized transactional mutations.
- [ ] Port the accepted officer shell and design primitives from pinned source.
- [ ] Implement Home, New Report, Reports, one incident workflow, Document
      Studio, history, and Account.
- [ ] Implement incident number/name, preparer selection, field notes, explicit
      unknowns, and deterministic missing-information review.
- [ ] Implement fact confirmation before generated narrative.
- [ ] Implement append-only revisions, restore-as-new-revision, concurrency,
      idempotency, and truthful persistence/conflict states.
- [ ] Implement deterministic DOCX and print output.
- [ ] Pass domain, contract, PostgreSQL, RLS, concurrency, idempotency,
      report-safety, browser, accessibility, visual, print, and export checks.
- [ ] Record owner workflow/output acceptance.

### Phase 3 exit

- [ ] A fictional officer completes the accepted incident/report flow in the
      protected Preview.
- [ ] Fabrication, stale write, duplicate retry, cross-user access, and silent
      persistence failure cases are tested and rejected.

## Phase 4 — forms and operational paperwork

- [ ] Connect Count Sheet calculations to authenticated persistence/history.
- [ ] Implement Count Sheet review, print, and export.
- [ ] Review every source definition for provenance, rights, revision, schema,
      and fictional-data safety before import.
- [ ] Implement approved Daily Paperwork flows.
- [ ] Implement approved Monthly packet catalog.
- [ ] Implement Forms Library selection, capabilities, paper preview, eligible
      download, controlled fields, N/A behavior, and packet actions.
- [ ] Keep Chain of Custody and other physical-only work physical-only.
- [ ] Pass revision, concurrency, idempotency, authorization, RLS, browser,
      accessibility, print/PDF, and failure-state tests.
- [ ] Record source/revision and records-owner disposition for every output.

### Phase 4 exit

- [ ] Approved paperwork and form flows pass protected-Preview and print/output
      acceptance using fictional data.

## Phase 5 — policy corpus and grounded assistance

- [ ] Identify authoritative source-object and legacy-index locations.
- [ ] Name the authorized corpus custodian.
- [ ] Approve rights for storage, processing, embedding, quoting, display,
      backup, migration, and bounded external-AI processing.
- [ ] Export original bytes; do not substitute filenames or embeddings.
- [ ] Inventory source/version/effective date/class/path/size/MIME/SHA-256/page
      count/rights/current-state/approval.
- [ ] Quarantine missing, duplicate, unreadable, unauthorized, or ambiguous
      sources.
- [ ] Import approved originals into private Storage.
- [ ] Implement authorized streaming/download behavior.
- [ ] Build versioned extraction/OCR, page maps, chunks/hashes, full-text index,
      embeddings, and vector index.
- [ ] Implement separate provider-neutral retrieval and generation adapters.
- [ ] Pin model/embedding IDs, timeouts, payload limits, retries, cost caps, and
      redacted errors.
- [ ] Review OpenAI project data controls/retention and keep API data sharing
      disabled.
- [ ] Implement Policy Expert and full reader with immutable source/version/page
      citations and insufficient-evidence behavior.
- [ ] Pass custodian-approved retrieval, citation, conflict/supersession,
      abstention, prompt-injection, invented-fact, access, latency, and cost
      evaluations.
- [ ] Back up and restore corpus objects/manifests, rebuild indexes, and rerun
      the golden set.

### Phase 5 exit

- [ ] Approved source counts/bytes/hashes/versions/pages/objects reconcile.
- [ ] Citation/refusal/injection/access evaluations pass on pinned
      configuration.
- [ ] Custodian and owner accept the corpus manifest and source behavior.

## Phase 6 — administration and operational controls

- [ ] Implement account/staff, incident, paperwork, audit, and health admin
      surfaces.
- [ ] Enforce fresh purpose-bound step-up for high-impact actions.
- [ ] Review allowlisted audit metadata and representative failure logs.
- [ ] Measure DOCX/PDF/OCR/ingestion workload duration and failures.
- [ ] Decide ADR-0005 from measurements.
- [ ] If required, add narrow queue/worker with leases, visibility, retries,
      dead letters, idempotency, and stale-result rejection.
- [ ] Add redacted request correlation and error/latency/Auth/Storage/DB/AI
      signals.
- [ ] Add cost/quota dashboards, alerts, budgets, and circuit breakers.
- [ ] Name incident/alert primary and alternate.
- [ ] Exercise credential rotation, dependency update, incident response,
      feature disablement, and application rollback.

### Phase 6 exit

- [ ] Admin/step-up tests, telemetry redaction, alert delivery, and applicable
      queue recovery exercises pass.

## Phase 7 — live-environment qualification

- [ ] Resolve plan/protection/recovery/AI-budget decisions.
- [ ] Create a separate live Supabase project in the approved U.S. region.
- [ ] Configure isolated Vercel Production values and Auth redirects.
- [ ] Verify all secret/configuration references without exposing values.
- [ ] Implement protected production migration dry-run/apply job.
- [ ] Implement encrypted off-provider logical database backup.
- [ ] Implement separate private-Storage inventory/object backup.
- [ ] Restore database and Storage into an isolated recovery project.
- [ ] Verify Auth-linked state, migration history, constraints, RLS, object
      checksums, corpus rebuild, and achieved RPO/RTO.
- [ ] Run expected-load plus margin tests using fictional data.
- [ ] Run concurrency, retry, provider-degradation, cost, and quota tests.
- [ ] Freeze exact release candidate and complete the dated release record.
- [ ] Pass web/database CI on the exact commit.
- [ ] Pass Auth/RLS/Storage negative and revoked-session tests.
- [ ] Pass authenticated fictional browser, accessibility, screen-reader,
      responsive, reduced-motion, visual, print, and degraded-provider checks.
- [ ] Pass approved-corpus retrieval/citation/refusal/injection evaluations.
- [ ] Verify monitoring, alerts, budgets, backups, restore, and rollback.
- [ ] Confirm no unresolved critical/high security issue.
- [ ] Record the exact candidate, migrations, corpus version, limitations,
      provider health, rollback target, and standing owner authorization.

### Phase 7 exit

- [ ] Named candidate passes every applicable release gate with retained
      evidence and no unapproved real operational data.

## Phase 8 — controlled production promotion and observation

- [ ] Recheck Vercel, Supabase, OpenAI, DNS, and dependency/provider health.
- [ ] Freeze changes and corpus ingestion.
- [ ] Record current live deployment, migration, corpus, configuration, and
      health baseline.
- [ ] Create and verify final database and Storage backups.
- [ ] Dry-run and apply the exact additive migration set to the verified target.
- [ ] Promote the exact qualified Vercel deployment without rebuilding.
- [ ] Run liveness/readiness and authenticated fictional qualification smoke:
      sign-in, role boundary, Home, one cleanup-safe incident/report, Count
      Sheet/form, policy citation/source, print/export, Account, and logout.
- [ ] Immediately contain/rollback any Auth/RLS/Storage isolation, sensitive
      logging, integrity, uncited-answer, or critical-route failure.
- [ ] Observe errors, latency, DB locks/connections, Auth, Storage, AI,
      cost/quota, and backup signals for at least 15 minutes.
- [ ] Observe the first representative invited-user window.
- [ ] Retain prior deployment and legacy system through the rollback window.
- [ ] Complete release record and owner-accept the result.

### Phase 8 exit

- [ ] Exact qualified artifact is live and browser verified.
- [ ] Production evidence, monitoring window, rollback state, and result are
      recorded and accepted.
- [ ] Legacy retirement remains a separate, unexecuted gate unless separately
      authorized.

## Immediate next actions

1. Run the local database gate with Docker Desktop.
2. Add secret/dependency scanning and readiness/environment validation.
3. Open the Phase 0/1 pull request and keep it merge-ready.
4. Build and evaluate the disposable authentication alias spike.
5. Implement the identity schema, authorization matrix, and negative tests.
6. Implement the sign-in/session/bootstrap vertical slice.
7. Begin incident/report parity work while corpus custody is resolved
   externally.
