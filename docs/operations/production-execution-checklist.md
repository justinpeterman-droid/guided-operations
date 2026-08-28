# Production execution checklist

**Goal:** Move Guided Operations from the verified no-data foundation to an
owner-authorized, isolated private Production release by completing the gated
sequence in [`ROADMAP.md`](../../ROADMAP.md).

**Started:** 2026-08-25  
**Working branch:** `codex/production-readiness`  
**Data boundary:** real operational/personal data only in isolated Production
after exact-candidate approval; Git, local development, CI, Preview, staging,
screenshots, logs, support tools, recovery rehearsals, and fixtures remain
fictional-only; real policy/reference content follows the corpus protocol.

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
- [x] Confirm no secret, real operational data, restricted corpus content,
      provider-link metadata, browser artifact, generated document/archive, or
      generated build output is tracked. The tracked-secret scanner and
      tracked-file inventory passed at `49f6413` on 2026-08-28.
- [x] Record the temporary manual repository controls necessitated by the
      current private-repository plan: pull request, green checks, review,
      no-force-push, and release record. PR #1 remains open from
      `codex/production-readiness` to `main`; branch pushes are allowed, but
      merge, deployment, hosted migration, and promotion remain separate owner
      gates.
- [x] Open a narrow pull request for Phase 0/1 foundation work: PR #1.
- [x] Confirm exact-commit Web quality CI is green for `9c6248f`; no review or
      inline comments were present at the 2026-08-25 check.
- [x] Confirm Web quality (`33172294619`), Database quality (`33172294839`),
      Recovery rehearsal (`33172294635`), and Authenticated browser quality
      (`33172294904`) are green for exact commit `49f6413` on 2026-08-28.
- [x] Confirm Web quality (`33173353076`), Database quality (`33173353098`),
      Recovery rehearsal (`33173353168`), and Authenticated browser quality
      (`33173353133`) are green for exact commit `d821926` on 2026-08-28 after
      adding disabled-account session revocation coverage.
- [x] Confirm Web quality (`33176099761`), Database quality (`33176099774`),
      Recovery rehearsal (`33176099780`), and Authenticated browser quality
      (`33176099890`) are green for exact commit `571493c` on 2026-08-28 after
      adding known/unknown sign-in resistance qualification.
- [x] Confirm Web quality (`33179879484`), Database quality (`33179879491`),
      Recovery rehearsal (`33179879596`), and Authenticated browser quality
      (`33179879481`) are green for exact commit `a045a43` on 2026-08-28 after
      adding two-phase global session revocation and two-browser denial proof.
- [x] Confirm Web quality (`33181418446`), Database quality (`33181418450`),
      Recovery rehearsal (`33181418452`), and Authenticated browser quality
      (`33181418441`) are green for exact commit `277c942` on 2026-08-28 after
      extending the same fail-closed protection and two-browser proof to
      personal passcode replacement.
- [x] Confirm Web quality (`33189510880`), Database quality (`33189510822`),
      Recovery rehearsal (`33189510855`), and Production-style Authenticated
      browser quality (`33189510850`) are green for exact commit `9a01c92` on
      2026-08-28. The dated local-candidate record keeps hosted, corpus, manual,
      owner, and promotion gates open.

### Phase 0 exit

- [x] Full web and local database gates pass on the Phase 0 content; GitHub Web
      quality is green for `9c6248f` and the local reset/lint/pgTAP replay has
      no database-source delta.
- [ ] Documentation and hosted state agree.
- [x] Security/dependency scanning is active in Web quality CI.
- [x] Repository-control path is recorded.

## Phase 1 — connected non-production environment

- [x] Supabase Development/Preview foundation project exists in `us-east-1`.
- [x] Foundation migration is applied with empty forced-RLS tables and private
      buckets.
- [x] Git-connected authoritative Vercel project exists.
- [x] Authoritative foundation is live at `https://guided-operations.vercel.app`
      with disabled sign-in.
- [x] Live foundation homepage and `/api/health/live` were browser/HTTP
      verified.
- [x] Confirm `iad1` function region in code/provider configuration. The
      2026-08-27 command-center requalification verified the linked project and
      latest protected Preview in `iad1`.
- [x] Re-establish read-only provider proof on 2026-08-28 with Vercel CLI
      59.7.0: the authenticated owner can inspect the authoritative project,
      project settings, protection posture, environment names/scopes, and the
      `READY` Preview for exact commit `06848a1`. Authenticated status checks
      for liveness, readiness, login, officer, and administrator routes return
      `200`; manual browser rendering remains open.
- [ ] Confirm the authoritative Vercel project contains only correctly scoped
      public Preview/Production values. Preview matches fictional Development,
      but the two Production-scoped Supabase server entries also match
      Development and must be removed under exact authorization before another
      Production build.
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
- [x] Extend readiness to validate the complete runtime variable contract,
      pinned AI/corpus identifiers, purpose-separated security keys, and
      explicit Production sign-in without exposing missing names or values.
- [x] Verify readiness locally and in a protected Preview (`94dfd61`,
      `dpl_EkjZg7P2BqZ1CD8Q5Aqner6CtuKJ`).
- [x] Reconcile the empty hosted non-production migration inventory without
      changing the hosted database. On 2026-08-27 the 10 hosted migrations were
      confirmed as the exact ordered prefix of the 57 repository migrations
      after four repository filenames were aligned to their already-shared
      versions. See
      [`non-production-migration-reconciliation.md`](non-production-migration-reconciliation.md).
- [x] Refresh the read-only hosted inventory on 2026-08-28: Development is
      healthy in `us-east-1` at 62 ordered migrations through
      `20260827120000_enforce_report_finalization_authority`; the repository has
      70 migrations, so eight remain pending and unapplied. The provider's 28
      authenticated security-definer warnings were catalog-checked for empty
      search paths, denied anonymous/elevated-role execution, private-helper
      isolation, and reviewed session-authorization anchors. See
      [`2026-08-28-hosted-readiness-refresh.md`](2026-08-28-hosted-readiness-refresh.md).
- [ ] Rebuild and qualify the reconciled migration set, run a linked dry-run,
      and apply the pending additive migrations only through the recorded
      non-production approval path.
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
- [x] Record that administrator MFA was deferred only for the no-data
      foundation.
- [ ] Resolve and test administrator MFA or an explicitly approved equivalent
      for the real-data Production target.
- [x] Define employee-number normalization and allowed passcode alphabet. The
      initial single-facility contract preserves leading zeroes, bounds the
      approved identifier characters, and requires 8–64 printable non-space
      ASCII passcode characters. Owner usability acceptance remains open before
      a real account is created (`docs/adr/0003-employee-number-pin-auth.md`).
- [x] Add a tested, provider-neutral minimum-passcode/common-pattern/employee-
      equality policy primitive without prematurely deciding the final
      identifier format or creating hosted accounts (`ab66239`).
- [x] Build disposable hosted alias-bridge spike: a generated non-deliverable
      alias issued a password session through server-side provisioning, and
      known-wrong/unknown aliases returned the same provider failure status; the
      temporary account was deleted. See ADR-0003 (2026-08-25).
- [ ] Prove the internal alias is absent from UI, APIs, redirects, recovery,
      email, logs, analytics, cookies, and browser storage.
  - [x] Local fictional Auth and browser qualification proves the alias and raw
        access/refresh values are absent from the encrypted cookie,
        `document.cookie`, and browser storage; hosted recovery/email/log review
        remains open.
- [x] Threat-model enumeration, timing, lockout denial, credential stuffing,
      token theft, Auth-admin key misuse, bootstrap, reset, role changes, and
      last-admin safety. ADR-0003 records the threats, controls, residual hosted
      checks, and the owner-approved implementation choice.
- [x] Accept ADR-0003's private server-only alias bridge without weakening the
      credential boundary. Hosted alias/recovery, lifecycle, MFA, and usability
      qualification remain separate release gates.
- [x] Add forward identity/account/rate-limit/audit migrations. The repository
      contains the default-deny account foundation, opaque attempt tracking,
      bootstrap, step-up, lifecycle, session-revocation, and redacted-audit
      migrations. Applying the pending migrations to a hosted target remains a
      separately authorized release step.
- [x] Add generated Data API types and an exact local migration drift check.
- [x] Add least-privilege routine and administrative server clients. Routine
      session/RLS clients use the publishable key, while the Auth-admin client
      is server-only and isolated to lifecycle ceremonies.
- [x] Implement sign-in with generic failures and layered throttling/lockout.
      Account, device, network, and global windows store only purpose-separated
      keyed digests; malformed, cross-origin, denied, unknown, and bad-secret
      requests share the generic no-store failure boundary.
- [x] Implement server-only authenticated encrypted session cookies that are
      HttpOnly/SameSite=Lax and Secure outside explicit local development/test;
      local tamper, chunk, alias/token non-exposure, safe redirect, and browser
      tests pass. Hosted qualification remains a separate gate.
- [x] Implement refresh rotation, expiry, logout, logout-all, forced temporary
      passcode change, reset revocation, and disabled-account behavior. Local
      route, service, database, and two-browser evidence covers the lifecycle;
      protected Preview expiry and provider-failure qualification remain release
      gates.
  - [x] Local database, route, and two-browser tests prove logout-all advances
        application authority before provider revocation, denies tokens during a
        bounded reconciliation window, seals the result afterward, and
        immediately denies a second active browser (`a045a43`). Hosted expiry
        and provider-failure qualification remain open.
  - [x] Personal passcode replacement uses the same bounded fail-closed token
        window, rejects overlapping changes, and seals authority only after the
        credential update and provider revocation both succeed. A fictional
        two-browser run proves the other session is denied and the replacement
        credential signs in (`277c942`, run `33181418441`).
- [x] Implement CSRF/origin checks and authenticated `no-store` behavior.
      Mutations require the configured same origin and session-bound CSRF proof;
      authenticated and sign-in responses use no-store behavior.
- [x] Implement server authorization plus operation-specific RLS/Storage rules.
      Sensitive operations recheck current account authority, private tables use
      forced RLS/default-deny grants, and private Storage buckets have explicit
      negative tests. Hosted requalification remains open below.
- [x] Implement protected first-admin bootstrap with generated temporary secret,
      single-use delivery, idempotency, forced change, and audit redaction.
- [x] Add a local-only, zero-account database bootstrap ceremony: transaction
      lock, pending administrator, forced expiring temporary credential state,
      private-delivery activation, failed-delivery cleanup, and allowlisted
      audit outcomes. The ceremony is not exposed to a browser route and has not
      been run with a real identity. The explicit
      `scripts/bootstrap-fictional-test-administrator.mjs` operator utility is
      restricted to `APP_ENV=development`, a zero-account fictional project, and
      its exact confirmation flag. It never accepts identity input or prints a
      temporary passcode; delivery is an on-screen, local clipboard handoff
      only. If that single fictional credential expires during local
      qualification, `scripts/rotate-fictional-test-administrator.mjs` can
      rotate only that fixed fictional account at the fixed fictional facility;
      it verifies provider claims and the local encrypted-session route before
      private clipboard delivery.
- [x] Implement account create, deactivate, role change, reset, and unlock with
      purpose-bound admin step-up, plus personal passcode and session controls.
      Local service, route, UI, and database tests exist; hosted migration and
      real-browser qualification remain separate release gates below.
- [x] Pass a guarded local real-provider known/unknown employee enumeration and
      timing test: both paths use password authentication, return the same 401
      body and no-store policy, and keep median response-time difference within
      the documented 300 ms local-CI bound (`571493c`, run `33176099890`).
- [ ] Pass direct database
      anonymous/authenticated/cross-user/cross-role/disabled and elevated-key
      negative tests.
  - [x] The isolated local pgTAP suite exercises actual `anon`, `authenticated`,
        and `service_role` database roles and fictional session claims. It
        proves private-schema/API denial for the elevated Data API role,
        anonymous and authenticated private-object denial, missing/malformed and
        stale claims, disabled-account denial, officer/admin role boundaries,
        cross-officer records, and cross-shift records. Protected hosted
        requalification remains open, so the parent gate is not complete.
- [x] Add local anonymous and authenticated negative tests proving both private
      Storage buckets deny listing, insertion, alteration, and direct deletion.
      Elevated-key qualification and hosted Storage evidence remain pending.
- [x] Pass guarded local real-browser sign-in, officer Count Sheet,
      incident/report, output, sign-out, and administrator lifecycle workflows
      with fictional qualification identities in pull-request CI (`49f6413`, run
      `33172294904`).
- [x] Prove in a real local browser that disabling an officer ends the officer's
      already-authenticated access and that the old credential receives the same
      generic sign-in failure (`d821926`, run `33173353133`).
- [ ] Complete bootstrap-ceremony qualification and protected hosted
      qualification without alias leakage.

### Phase 2 exit

- [x] ADR-0003 is Accepted with spike and threat-model evidence. This records
      the architecture decision only; it does not close the hosted Auth, MFA, or
      remaining Phase 2 exit gates.
- [ ] Auth, session, lifecycle, server authorization, RLS, Storage, and
      bootstrap positive/negative evidence is complete.
- [ ] Protected Preview supports fictional officer/admin identities without
      alias leakage or cross-account access.

## Phase 3 — incident and report vertical slice

- [ ] Freeze the first parity slice and record omissions.
- [x] Define versioned Zod/domain contracts for fictional incident revisions,
      confirmed-fact provenance, explicit unknown/not-applicable states, and
      report-draft references that exclude unreviewed narrative (`45f0c0b`).
- [x] Add incident, fact, draft, revision, export, audit, and idempotency
      schema. Forward migrations cover incident/report heads and immutable
      revisions, candidate/finalization state, audited print/export, guarded
      retries, and current-version conflict handling.
- [x] Add the initial default-deny incident/report foundation: incident and
      report heads, immutable revisions, report access relationships, indexes,
      forced RLS, revoked direct grants, and pgTAP checks (`25ad616`; local
      replay/lint/30 pgTAP and GitHub Database quality passed).
- [x] Add constraints, indexes, grants, forced RLS, and append-only protections.
- [x] Implement server-only reads and authorized transactional mutations.
      Reviewed RPCs conceal unauthorized records and bind every mutation to the
      current session, role, facility, officer relationship, revision, and
      idempotency boundary required by that operation.
- [x] Add a narrow server-only immutable incident-revision read: current session
      authority is checked before the authenticated RPC; a missing or
      unauthorized revision is concealed; returned data omits field notes and
      identity/facility metadata; pgTAP verifies active-admin access and
      unrelated-officer denial (local replay/lint/pgTAP passed on the pending
      review commit).
- [ ] Port the accepted officer shell and design primitives from pinned source.
- [x] Implement Home, New Report, Reports, one incident workflow, Document
      Studio, history, and Account.
- [x] Implement incident number/name, preparer selection, field notes, explicit
      unknowns, and deterministic missing-information review.
- [x] Implement fact confirmation before generated narrative. Draft generation
      accepts only officer-confirmed, source-linked facts from the authorized
      immutable incident revision; unknown, not-applicable, proposed, and
      unrelated-officer facts are rejected.
- [x] Add the guarded report-draft candidate boundary: it reads one authorized
      immutable revision, limits generation to selected confirmed facts,
      validates paragraph provenance, requires same-origin/session-CSRF/retry
      controls, and stores the review-only candidate before returning success
      (local unit and PostgreSQL checks pass; hosted CI remains a per-commit
      review gate).
- [x] Add the separate human-only report-finalization boundary: it requires an
      explicit officer review attestation and replacement narrative, creates an
      immutable first report revision with candidate provenance, and returns
      only an opaque report ID (local unit and PostgreSQL checks pass; hosted CI
      remains a per-commit review gate).
- [x] Implement append-only revisions, restore-as-new-revision, concurrency,
      idempotency, and truthful persistence/conflict states.
- [x] Record redacted, idempotent audit metadata before protected current-report
      print requests and reject stale or unauthorized revisions.
- [x] Implement deterministic explicit-version reviewed-report DOCX plus
      current-version browser print. Keep official 005/409 output open until the
      source form and mapping are approved and fidelity-qualified.
- [x] Pass the guarded fictional local officer/administrator browser flow for
      incident creation, per-officer fact selection, draft review/finalization,
      stale-write recovery, revision restore, exact-version Word downloads,
      print audit, administrator cross-officer review, and sign-out (`49f6413`,
      run `33172294904`).
- [ ] Pass domain, contract, PostgreSQL, RLS, concurrency, idempotency,
      report-safety, browser, accessibility, visual, print, and export checks.
- [ ] Record owner workflow/output acceptance.

### Phase 3 exit

- [ ] A fictional officer completes the accepted incident/report flow in the
      protected Preview.
- [ ] Fabrication, stale write, duplicate retry, cross-user access, and silent
      persistence failure cases are tested and rejected.

## Phase 4 — forms and operational paperwork

- [x] Connect Count Sheet calculations to authenticated persistence/history.
- [x] Implement Count Sheet saved-revision review and append-only restore.
- [x] Record redacted, idempotent audit metadata before protected Count Sheet
      print requests.
- [x] Pass the automated Count Sheet desktop calculation, keyboard, reduced-
      motion mobile, print marker/fit, assigned-shift save/reopen/history/
      restore, and audited-print browser checks with fictional data (`49f6413`,
      run `33172294904`).
- [ ] Complete owner-reviewed physical print qualification and supported Count
      Sheet export.
- [ ] Review every source definition for provenance, rights, revision, schema,
      and fictional-data safety before import.
  - [x] Pin all six sanitized old-app definitions to the canonical legacy
        commit, exact Git blobs, and byte sizes; confirm that those blobs
        contain no completed staff identities, employee numbers, historical
        entries, or populated equipment identifiers; and record the approved
        A/B, C/D, U, and F shift meanings.
  - [ ] Acquire and verify the source bodies only inside isolated Production,
        compute SHA-256, record source-revision/rights approval, and register
        them through a protected template-import workflow.
  - [x] Add a server-only all-six-or-nothing source-package validator that
        enforces exact filenames/kinds, bounded closed schemas, blank equipment
        identifiers, unique codes, and value-free SHA-256/byte-count evidence.
        It has no hosted write path and uses only fictional unit-test content.
  - [x] Complete the scoped Production import threat model. It requires a
        Production-only route, exact package and mapped-definition digests,
        pinned mapper version, purpose-bound single-use approval, atomic six-row
        registration, value-free evidence, readback, and append-only rollback.
        Implementation and hosted qualification remain open.
  - [x] Implement the protected code path without importing source bodies: a
        pinned source-to-renderer mapper, digest-bound package manifest,
        Production-only review/register routes, exact-package administrator
        step-up, private append-only package registry, atomic six-template
        registration, concurrency/idempotency controls, and fictional tests.
  - [x] Add the Production-only administrator package screen with automatic
        current-package concurrency binding, exact six-file review, frozen
        review inputs, package-bound passcode confirmation, value-free history,
        and an inert fictional visual preview. Rollback selection UI remains
        open.
  - [ ] Replay the package migration and pgTAP suite in PostgreSQL, then
        complete hosted qualification, owner fidelity review, and the real
        Production import under separate authorization.
  - [x] Complete a security diff review of that implementation and fix both
        confirmed issues: require a pre-parse multipart length bound, and prove
        every rollback definition exactly matches its referenced immutable
        package. Local database execution remains open while Docker is stopped.
- [x] Implement the generic protected Daily Paperwork open, save, immutable
      history, exact restore, stale-write protection, and audited-print engine.
- [ ] Import and map all six approved Daily Paperwork definitions and prove
      screen/print fidelity against the owner-approved references.
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

- [x] Implement the local private registry foundation for rights/current
      version, ingestion-run provenance, page QA, bounded chunk mappings, and
      retrieval exclusion of unapproved evidence. This is fictional local/CI
      proof only and does not satisfy the hosted R2 or corpus gates.
- [ ] Identify authoritative source-object and legacy-index locations.
- [ ] Name the authorized corpus custodian.
- [ ] Approve rights for storage, processing, embedding, quoting, display,
      backup, migration, and bounded external-AI processing.
- [ ] Export original bytes; do not substitute filenames or embeddings.
- [ ] Inventory source/version/effective date/class/path/size/MIME/SHA-256/page
      count/rights/current-state/approval.
- [x] Add a strict offline private-corpus manifest verifier that reconciles
      reviewed metadata, source bytes, scan binding, version chains, duplicate
      approvals, and content-addressed object keys while emitting only
      value-free aggregate evidence. The real private manifest has not been
      supplied or accepted, so the inventory and custodian gates remain open.
- [ ] Quarantine missing, duplicate, unreadable, unauthorized, or ambiguous
      sources.
- [ ] Import approved originals into private Storage.
- [x] Implement session-bound same-facility authorization, user-bound Storage
      RLS, and a server-only private PDF reader that verifies exact object path,
      size, MIME type, PDF signature, and SHA-256 before delivery. Routine reads
      never use the Supabase secret credential. Local database and route
      negative tests pass; real corpus import and hosted browser proof remain
      open.
- [ ] Build versioned extraction/OCR, page maps, chunks/hashes, full-text index,
      embeddings, and vector index.
- [x] Implement separate provider-neutral retrieval and generation adapters,
      including database-enforced approved-version filtering for bounded
      evaluation and catalog requests.
- [ ] Pin model/embedding IDs, timeouts, payload limits, retries, cost caps, and
      redacted errors.
- [ ] Review OpenAI project data controls/retention and keep API data sharing
      disabled.
- [x] Implement Policy Expert and the protected full-source reader with
      immutable source/version/page citations and insufficient-evidence
      behavior. Each visible citation opens the authorized, checksum-verified
      immutable PDF through the same-session private reader; approved real
      corpus and hosted evaluation remain open.
- [ ] Pass custodian-approved retrieval, citation, conflict/supersession,
      abstention, prompt-injection, invented-fact, access, latency, and cost
      evaluations.
- [x] Implement and unit-test a provider-neutral, value-free scorecard for
      citation recall/precision, abstention, injection markers, and p95 latency.
      Category labels must match their required outcomes, and forbidden-marker
      checks cover both the primary answer and every user-visible limitation.
      The private approved-corpus run and human acceptance remain open.
- [ ] Back up and restore corpus objects/manifests, rebuild indexes, and rerun
      the golden set.

### Phase 5 exit

- [ ] Approved source counts/bytes/hashes/versions/pages/objects reconcile.
- [ ] Citation/refusal/injection/access evaluations pass on pinned
      configuration.
- [ ] Custodian and owner accept the corpus manifest and source behavior.

## Phase 6 — administration and operational controls

- [x] Implement account/staff, incident, paperwork, audit, and health admin
      surfaces. The shared incident/report workspace applies administrator
      cross-officer authority; dedicated protected pages cover accounts, Daily
      Paperwork, redacted audit, retention, and system health.
- [x] Enforce fresh purpose-bound step-up for high-impact actions. Account
      lifecycle, legal-hold, and retention-deletion routes consume short-lived,
      same-administrator, single-use proofs bound to the exact action.
- [ ] Review allowlisted audit metadata and representative failure logs.
- [ ] Measure DOCX/PDF/OCR/ingestion workload duration and failures.
- [ ] Decide ADR-0005 from measurements.
- [ ] If required, add narrow queue/worker with leases, visibility, retries,
      dead letters, idempotency, and stale-result rejection.
- [ ] Add redacted request correlation and error/latency/Auth/Storage/DB/AI
      signals.
- [x] Implement a strict allowlisted operational-event boundary for sign-in and
      the core policy-answer and report-draft routes, with content-leakage tests
      and a fail-closed Production readiness gate. Policy-source, incident-fact,
      and administrator Daily Paperwork package operations also emit
      content-free status and duration events; the package route returns
      matching request correlation without source filenames, metadata, bodies,
      package digests, or administrator identity. Hosted sinks, the remaining
      route signals, retention/access, alerts, and delivery tests remain open.
- [x] Maintain a machine-checked production data inventory covering every
      private application table and Storage bucket plus Auth, AI, logs, browser,
      non-production, support, and backup surfaces. Hosted settings, deletion
      automation, and evidence reconciliation remain open.
- [x] Encode a 730-day post-archive deletion-review date for operational record
      heads and a private, target-validated, audited legal-hold model. Protected
      `/admin/retention` placement and release require separate same-session,
      one-time administrator step-up proofs; direct Data API access remains
      denied.
- [x] Implement a fail-closed controlled deletion path for complete incident
      packages and eligible paperwork records. Approval and execution require
      separate single-use administrator proofs; approval requires verified
      database/Storage backup evidence and expires after 24 hours; execution
      requires exact record-ID confirmation, locked hold/eligibility rechecks,
      manifest-bound private-Storage verification, and same-transaction database
      deletion. Local PostgreSQL, route, component, and negative tests pass.
      Hosted backup jobs, hosted restore/deletion rehearsal, operational
      authority for a specific live deletion, and owner release approval remain
      open. No hosted data was changed.
- [x] Add a fail-closed shared application AI request circuit breaker with an
      honest degraded state and content-free aggregate counters; local database
      qualification remains part of this branch.
- [ ] Approve and configure the monthly request cap, stop percentage, OpenAI
      project budget, cost/quota dashboards, alerts, and test notifications.
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
- [x] Implement a manual-only, fail-closed production migration dry-run/apply
      workflow pinned to an exact commit, migration head, project, region, owner
      reference, reviewed dry-run, and backup evidence. The protected GitHub
      environment is not yet configured and no remote run has occurred.
- [x] Implement a fail-closed protected-operator tool that streams a full
      logical database archive directly into public-key encryption, permits no
      Production values in CI/local development, and writes only value-free
      aggregate evidence. A hosted run, schedule, decryption, and restore remain
      open.
- [x] Implement private-Storage inventory/object backup that rejects public
      buckets, encrypts every object under an opaque name, reconciles source
      byte counts/checksums, and encrypts the detailed manifest. A hosted run
      and restore remain open.
- [x] Implement and locally pass a fictional database archive restore plus
      private-Storage API copy/checksum rehearsal with bounded value-free
      evidence and verified cleanup.
- [ ] Promote the passing local fictional database-plus-Storage recovery
      rehearsal to protected hosted backup jobs and an isolated replacement
      Supabase project. Local proof alone does not close this gate.
- [ ] Rehearse the controlled deletion workflow in an isolated hosted project
      with fictional data: verified database and Storage backups, legal-hold
      race rejection, failed-Storage rollback, post-removal database rollback
      followed by Storage restore, completed evidence, and safe retry.
- [ ] Restore database and Storage into an isolated recovery project.
- [ ] Verify Auth-linked state, migration history, constraints, RLS, object
      checksums, corpus rebuild, and achieved RPO/RTO.
- [ ] Run expected-load plus margin tests using fictional data.
- [ ] Run concurrency, retry, provider-degradation, cost, and quota tests.
- [ ] Freeze exact release candidate and complete the dated release record.
- [x] Add a local release-record verifier that binds qualification, approval,
      promotion, rollback compatibility, backups, evidence, and the 15-minute
      Production watch to one exact artifact. Real records remain private and no
      hosted release has been verified.
- [ ] Pass web/database CI on the exact commit.
  - [x] Current pre-release branch commit `9a01c92` passed Web quality
        (`33189510880`) and Database quality (`33189510822`). Re-run and bind
        the evidence after the release candidate is frozen.
- [ ] Pass Auth/RLS/Storage negative and revoked-session tests.
- [ ] Pass authenticated fictional browser, accessibility, screen-reader,
      responsive, reduced-motion, visual, print, and degraded-provider checks.
      The guarded fictional officer/admin workflow lane is automated; the
      remaining specialized and hosted checks stay open.
  - [x] Current pre-release branch commit `9a01c92` passed the Production-style
        guarded fictional browser lane (`33189510850`).
  - [x] Local automated accessibility checks cover WCAG 2.0/2.1 A and AA plus
        WCAG 2.2 AA, browser/page/request errors, visible keyboard focus, a
        390-by-844 mobile viewport, horizontal overflow, and reduced motion.
        Manual screen-reader, zoom/reflow, visual/print acceptance, degraded
        providers, and protected hosted proof remain open.
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

1. Rebuild the timestamp-reconciled migration set from zero and rerun exact-head
   web, database, and recovery CI.
2. Run a read-only linked non-production migration dry-run and review its exact
   pending list before any hosted apply.
3. Apply the approved additive set to the empty non-production project, then
   create fictional Officer and Administrator qualification accounts.
4. Run hosted Auth, RLS, Storage, browser, accessibility, responsive, print, and
   degraded-provider qualification; remove the fictional accounts and data when
   evidence is retained.
5. Ingest the approved corpus only after its private manifest and provider-use
   controls pass, then run citation, refusal, and injection evaluation.
6. Freeze an exact candidate and complete the isolated Production setup, restore
   rehearsal, promotion, smoke tests, monitoring window, rollback test, and
   final owner acceptance.
