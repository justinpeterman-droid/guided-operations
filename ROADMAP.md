# Guided Operations production roadmap

This roadmap turns the replacement foundation created on 2026-08-25 into an
owner-authorized private production release. It is ordered by risk and
dependency, not by visual prominence. A phase is complete only when its exit
evidence is recorded. A merge, green CI run, provider project, or successful
deployment is not production approval by itself.

## What "production" means here

The target is a private internet-reachable production application for a small
invited group of officers. The owner authorized real operational and personal
data in the isolated Production environment on 2026-08-26, with two-year
retention. It remains forbidden in Git and every non-production environment.
Real-data entry still requires all release evidence in
`docs/operations/real-data-governance.md`; this cannot be enabled by quietly
changing an environment variable or checking off a plan item.

## Verified starting point — 2026-08-25

| Area                    | Verified state                                                                                                                                                                                    | What it does not prove                                                                                                       |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Repository              | Private `justinpeterman-droid/guided-operations`; `main` foundation commit `b4aa07a`; no local source changes before this roadmap update                                                          | Protected release process or production approval                                                                             |
| Web quality             | GitHub Web quality and Database quality passed on `b4aa07a`; local format, lint, typecheck, 8 unit tests, and production build pass                                                               | Authenticated workflows, data access, RAG, accessibility, or production behavior                                             |
| Browser                 | The local Chromium foundation smoke passes with the sign-in controls intentionally disabled                                                                                                       | Hosted application content behind Vercel protection                                                                          |
| Supabase                | A Free project in `us-east-1` was recorded `ACTIVE_HEALTHY` after the foundation migration; nine application tables were empty; RLS was enabled and forced; runtime grants/policies were deny-all | Current provider state, application connectivity, authentication, usable RLS policies, backups, or production data readiness |
| Vercel                  | A protected Preview for foundation commit `2be84e0` was created                                                                                                                                   | Git linkage, environment correctness, application-page verification, or Production promotion                                 |
| Product migration       | The predecessor is pinned at commit `ebe52c4`; Count Sheet calculations/types/parser and tests were ported                                                                                        | Feature parity with incident reports, forms, administration, or Policy Expert                                                |
| Corpus                  | A legacy filename manifest describes 292 unique PDF names; one tracked PDF-like object was found                                                                                                  | Possession of all source bytes, rights, current versions, page maps, or trustworthy citations                                |
| Local database evidence | Database CI is green on the current commit                                                                                                                                                        | A fresh local replay; Docker Desktop was not running during the 2026-08-25 roadmap audit                                     |

The hosted details and limitations are recorded in
[Hosted foundation record](docs/operations/2026-08-25-hosted-foundation.md).

## Current launch blockers

1. The Vercel project is not linked to the private GitHub repository and its
   application content has not been remotely inspected.
2. The current Supabase project must be designated non-production; a separate
   live project is required before release.
3. ADR-0003 authentication is Proposed. There are no connected accounts,
   sessions, account lifecycle, runtime grants, or usable RLS policies.
4. The product core is not implemented. The current page is an honest foundation
   screen, not the officer workspace.
5. The policy corpus lacks authoritative bytes, rights classification, current
   version approval, SHA-256 inventory, page maps, and citation reconciliation.
6. Database and Storage backup automation and a successful isolated restore
   drill do not exist.
7. Production monitoring, alert routing, cost caps, and release/rollback proof
   do not exist.
8. GitHub branch protection and private-repository rulesets are unavailable on
   the current account plan. The owner must upgrade or formally accept and
   document compensating release controls.
9. Vercel Hobby Standard Protection does not protect the Production domain.
   Application authentication remains mandatory; provider-level Production
   protection requires a plan decision.
10. Supabase Free projects can pause for low activity and require operator-run
    off-provider database and Storage backups. The owner must accept or remove
    those limitations before release.

## Delivery sequence

| Order | Phase                                            | Current status                   |              Working estimate | Primary exit gate                                                 |
| ----: | ------------------------------------------------ | -------------------------------- | ----------------------------: | ----------------------------------------------------------------- |
|     0 | Foundation closure and repository controls       | In progress                      |          1–2 engineering days | Truthful baseline, reproducible gates, reviewed decisions         |
|     1 | Connected non-production environment             | Partially complete               |                      1–2 days | Remotely verified protected preview using non-production services |
|     2 | Identity, sessions, authorization, and bootstrap | Blocked on owner/auth decisions  |                      5–8 days | Accepted ADR-0003 and negative security tests                     |
|     3 | Incident and report vertical slice               | Planned                          |                    10–15 days | Accepted end-to-end fictional incident/report workflow            |
|     4 | Forms and operational paperwork                  | Planned                          |                     8–12 days | Accepted persistence, print, export, and records behavior         |
|     5 | Policy corpus and grounded assistance            | Blocked on corpus custody/rights |       10–20 days after access | Reconciled corpus and passing citation/refusal evaluation         |
|     6 | Administration and operational controls          | Planned                          |                      5–8 days | Step-up admin, audit, monitoring, and recovery exercises pass     |
|     7 | Live-environment qualification                   | Planned                          |                      3–5 days | Named release candidate passes every applicable release gate      |
|     8 | Owner-authorized promotion and observation       | Planned                          | 1–2 days plus rollback window | Production evidence accepted; rollback retained                   |

These are planning ranges for focused engineering work, not calendar promises.
Owner decisions, independent review, corpus acquisition, and provider access are
not included. A realistic single-workstream target is approximately 10–14 weeks
after the blocking decisions and authoritative corpus are available. Corpus
discovery can run alongside Phases 1–4, but corpus import cannot bypass Phase 5.

## Phase 0 — foundation closure and repository controls

Status: **in progress**

### Steps

1. Review `PRODUCT.md`, `ARCHITECTURE.md`, `SECURITY.md`, this roadmap, and
   ADR-0001/0002/0004/0006 with the owner. Record acceptance or corrections.
2. Keep ADR-0005 Proposed until measured workload evidence either selects a
   worker or proves Vercel-sized jobs are sufficient.
3. Start Docker Desktop and reproduce the database gate locally:

   ```powershell
   npm run db:start
   npm run db:reset
   npm run db:lint
   npm run db:test
   npm run db:stop
   ```

4. Capture the migration head and test result; do not connect `db:reset` to a
   hosted project.
5. Decide the repository-protection path:
   - preferred: upgrade to a GitHub plan that supports private-repository branch
     protection/rulesets, require pull requests, the Web quality and Database
     quality checks, resolved conversations, and no force-push; or
   - temporary hobby exception: prohibit direct release from `main`, require a
     reviewed pull request and green checks by procedure, record the reviewer
     and commit in each release record, and acknowledge that GitHub cannot
     enforce the rule.
6. Add CI secret scanning, dependency vulnerability review, and a documented
   action/dependency update policy. Keep GitHub Actions pinned by immutable SHA.
7. Review the queued Dependabot updates individually. Never merge a bulk update
   only to clear a queue.
8. Create GitHub issues/milestones matching Phases 1–8 and link each pull
   request to one acceptance gate. Do not use issue completion as release proof.
9. Confirm no secrets, real roster/operational data, corpus bytes, build output,
   Vercel metadata, or local Supabase state are tracked.

### Exit evidence

- Full web gate and local database replay pass on the same commit.
- Source-of-truth documents agree about the hosted foundation state.
- Accepted ADRs and remaining owner questions are dated.
- Repository-control choice and reviewer are recorded.
- Security/dependency scanning is active or has an explicit owner-approved
  exception with an expiration date.

## Phase 1 — connected non-production environment

Status: **partially complete; provider projects exist but linkage is open**

### Steps

1. The owner authenticates Vercel and Supabase through their credential stores.
   Do not paste tokens into Git, chat, documentation, screenshots, or shell
   scripts.
2. Designate the existing `guided-operations` Supabase project as Development /
   Preview. Record that it is not the future live database.
3. Approve the aligned Vercel function region. The current candidate is `iad1`
   beside Supabase `us-east-1`.
4. Link the private GitHub repository to the existing Vercel project and verify
   the team, project, framework preset, root directory, Node version, and build
   command.
5. Configure Preview-scoped values for: `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `APP_ENV=preview`, and the exact
   `APP_ORIGIN`. Do not add `SUPABASE_SECRET_KEY` to browser code or routine
   runtime paths.
6. Add a readiness check that proves server-to-database configuration without
   exposing project details. Keep `/api/health/live` as process liveness; do not
   make liveness depend on every provider.
7. Confirm public signup and unapproved recovery are disabled. Keep the sign-in
   form disabled until Phase 2 passes.
8. Confirm Vercel Standard Protection for previews and generated deployment
   URLs. Decide before Phase 7 whether application authentication alone is
   sufficient for the live Hobby domain or whether paid provider-level
   Production protection is required.
9. Create a pull request and verify that Vercel builds the exact commit after
   CI.
10. Inspect the protected Preview in a real browser at desktop and mobile sizes:
    page text, health/readiness behavior, console errors, failed assets, caching
    headers, source maps, keyboard focus, and protection boundaries.

### Exit evidence

- A protected Preview deployment ID maps to the reviewed commit.
- Preview points only to the designated non-production Supabase project.
- Browser screenshots/network evidence contain no credentials or restricted
  data.
- The page and health/readiness endpoints are remotely verified, not inferred
  from provider state.

## Phase 2 — identity, sessions, authorization, and bootstrap

Status: **in progress; ADR-0003 security acceptance remains required before
production login**

### Steps

1. Approve the passcode length/alphabet/common-pattern rules, admin assurance
   method, first-admin owner, reset owner, unlock owner, and temporary-secret
   custodian.
2. On a disposable hosted Supabase project, spike the server-only random alias
   bridge proposed in ADR-0003. Prove the alias cannot leak through errors,
   recovery, email, logs, browser storage, redirects, or public Auth endpoints.
3. Threat-model employee enumeration, timing differences, lockout denial of
   service, credential stuffing, stolen refresh tokens, Auth-admin key misuse,
   bootstrap, reset, last-admin removal, and stale JWT role claims.
4. Accept ADR-0003 if the spike passes. If it fails, write a replacement ADR for
   custom opaque sessions; do not weaken the personal-passcode requirement.
5. Add forward-only migrations for keyed employee lookup, account status, role,
   `auth_version`, forced-change state, session/audit metadata, rate-limit
   state, indexes, constraints, and least-privilege execute grants.
6. Implement separate server-only clients for routine user requests and narrow
   administrative Auth operations. Routine requests must carry the user's
   identity so RLS can evaluate it.
7. Implement SSR Secure/HttpOnly/SameSite cookies, refresh rotation, expiry,
   logout, logout-all, reset revocation, disabled-account checks, safe
   redirects, CSRF/origin checks, and `no-store` behavior for authenticated
   pages.
8. Implement default-deny operation-specific RLS/Storage policies and server
   authorization for officer, administrator, disabled, missing-identity,
   cross-user, and cross-role cases.
9. Build the protected first-admin ceremony with a generated temporary secret,
   one-time delivery, forced change, idempotency, audit redaction, and
   zero-account/last-admin safeguards. Never print credentials to logs.
10. Add layered rate limits and bounded lockout across account, device/network,
    and global dimensions. Use generic responses and test known/unknown account
    timing.
11. Add account create, deactivate, role change, reset, unlock, and personal
    passcode/session-management flows with purpose-bound admin step-up.
12. Run direct-database negative tests and real-browser auth/session tests. UI
    hiding does not count as authorization evidence.

### Exit evidence

- ADR-0003 is Accepted with spike and threat-model evidence.
- No public signup/recovery or alias exposure exists.
- Login, refresh, rotation, expiry, logout-all, disabled account, role change,
  reset, lockout, step-up, bootstrap, RLS, and Storage negative tests pass.
- One fictional officer and one fictional administrator can use a protected
  Preview; cross-account access is denied and audited without sensitive data.

## Phase 3 — incident and report vertical slice

Status: **planned**

### Steps

1. Freeze the first parity slice from the pinned predecessor commit: Home, New
   Report, Reports, one incident workflow, Document Studio, history, and
   Account. Record intentional omissions.
2. Define versioned Zod/domain contracts before routes or UI. Keep the old Flask
   API as behavior evidence, not a compatibility target.
3. Add incident, fact, draft, revision, attachment/export, and idempotency
   migrations with constraints, indexes, append-only protections, optimistic
   concurrency, grants, and RLS.
4. Implement a server-only data-access layer and Server Actions. Every mutation
   performs authentication, current-account check, authorization, validation,
   CSRF/origin verification, concurrency check, and transaction handling.
5. Port the accepted design system and officer shell from the pinned React
   source. Remove Flask, `/workspace`, mock API, and Google assumptions.
6. Implement incident identity using official incident number and descriptive
   incident name, officer/preparer selection, field notes, missing-information
   review, and explicit unknown states.
7. Implement deterministic fact confirmation before any generated narrative. AI
   drafts remain visibly unreviewed and cannot create or alter source facts.
8. Implement report drafts, append-only revisions, restore-as-new-revision,
   ownership/history, persistence status, conflict handling, and retry-safe
   mutations.
9. Implement deterministic DOCX/print output behind an interface. Benchmark
   document generation before deciding whether ADR-0005 needs a worker.
10. Add unit, contract, PostgreSQL, RLS, concurrency, stale-write, idempotency,
    report-safety golden, export, browser, keyboard, responsive, accessibility,
    visual, and print tests using fictional data.

### Exit evidence

- A fictional officer can create, review, revise, restore, print/export, and
  find one incident/report end to end in protected Preview.
- Fabrication, stale writes, cross-user access, duplicate retries, and silent
  save failures are rejected and tested.
- The owner accepts the workflow, copy, visual result, and generated document.

## Phase 4 — forms and operational paperwork

Status: **planned**

### Steps

1. Connect the already-ported Count Sheet calculations to authenticated
   persistence, history, review, print, and export without changing the tested
   domain formulas silently.
2. Import only reviewed form definitions from the pinned predecessor source.
   Validate source revision, rights, schema, and fictional-data safety before
   copying each template.
3. Implement Daily Paperwork storage/UI/print flows, then the approved Monthly
   packet catalog.
4. Implement Forms Library search/selection, capability labels, paper-accurate
   preview, eligible download, controlled editable fields, N/A behavior, and
   packet actions.
5. Keep Chain of Custody and every other physical-only workflow physical-only
   unless a new product/records decision explicitly changes it.
6. Apply the same append-only revision, concurrency, idempotency, ownership,
   audit-redaction, server authorization, and RLS rules as incident reports.
7. Compare screen, print, PDF, and editable outputs against owner-approved
   references. Do not mass-regenerate snapshots to make CI green.
8. Test desktop/mobile layouts, 200% text resize, 320 CSS-pixel reflow,
   keyboard/screen-reader flow, reduced motion, print pagination, and failed
   save/export states.

### Exit evidence

- Count Sheet, approved Daily Paperwork, approved Monthly packets, and Forms
  Library pass persistence, history, print/export, RLS, and owner review.
- Every output has a recorded source/revision and records-owner disposition.
- Physical-only workflows remain clearly labeled and cannot be submitted by the
  app.

## Phase 5 — policy corpus and grounded assistance

Status: **blocked on OQ-008, OQ-009, and OQ-010**

### Steps

1. Name the authoritative corpus location and custodian. Confirm rights to
   store, process, embed, quote, display, back up, migrate, and send bounded
   content to the chosen AI provider.
2. Export the original bytes for every approved source before legacy retirement.
   The 292-name Git manifest and old embeddings are not substitutes for source
   objects.
3. Build an inventory with source ID, title, version/effective date, access
   class, original path, byte size, MIME type, SHA-256, page count, rights,
   current/superseded state, and approval.
4. Quarantine missing, duplicate, unreadable, unauthorized, or version-ambiguous
   sources. Reconciliation must fail closed.
5. Import approved originals into private Storage and implement authorized
   streaming/download paths. Do not use public buckets or durable public URLs.
6. Build versioned extraction/OCR, page maps, chunks, chunk hashes, full-text
   indexes, embeddings, and vector indexes. Derived records must trace to the
   exact source SHA-256 and extraction/embedding profile.
7. Implement provider-neutral retrieval and generation adapters. Treat source
   text as untrusted data, separate retrieval from generation, pin model and
   embedding identifiers, and enforce timeouts, payload limits, cost caps, and
   redacted errors.
8. Review current OpenAI project data controls and endpoint retention before
   sending restricted corpus text. Do not opt in to API data sharing. Decide
   whether default retention is acceptable or approved retention controls are
   required.
9. Port Policy Expert and the archived full-policy-reader behavior: approved
   source IDs, source/version/page citations, bounded passages, original-PDF
   fallback, passage highlighting, and accessible focus restoration.
10. Build a custodian-approved golden set covering retrieval relevance,
    claim-to-passage citations, conflicting/superseded policy, low evidence,
    abstention, prompt injection, invented facts, access denial, latency, and
    cost.
11. Back up source objects and manifests off-provider, restore them into an
    isolated project, rebuild the index, and rerun the golden set.

### Exit evidence

- Approved inventory counts, bytes, SHA-256 hashes, versions, page maps, and
  private Storage objects reconcile exactly.
- Citation/refusal/injection/access-control evaluations pass the owner-approved
  thresholds on the pinned model/retrieval configuration.
- The corpus custodian approves the manifest and user-visible source behavior.
- Backup/restore proves the corpus can be recovered without Google Cloud.

## Phase 6 — administration and operational controls

Status: **planned**

### Steps

1. Implement administrator account/staff management, incident administration,
   paperwork command center, audit review, system health, and bounded
   notifications.
2. Require fresh purpose-bound step-up for credential reset, role change,
   account disablement, corpus promotion, destructive cleanup, and other
   high-impact actions.
3. Keep audit metadata allowlisted: action, outcome, opaque IDs, timestamps,
   build/version, and bounded reason codes. Never log narratives, policy text,
   prompts/responses, employee numbers, credentials, tokens, or signed URLs.
4. Measure DOCX/PDF/OCR/ingestion duration and failure behavior under provider
   limits. If long work is required, decide ADR-0005 and add Supabase Queues
   plus one narrow non-Google worker.
5. Qualify queue/outbox transactions, leases, visibility timeouts, bounded
   retries, poison messages, dead letters, idempotent completion, and stale
   result rejection.
6. Add redacted application telemetry, request correlation, health/readiness,
   error/latency/Auth/Storage/database/AI metrics, cost and quota signals, and
   alert routing with a named primary and alternate.
7. Set provider budgets and circuit breakers. A provider limit must create an
   honest degraded state, not fabricated output or partial silent saves.
8. Exercise credential rotation, dependency update, incident response,
   application rollback, and feature-disable procedures.

### Exit evidence

- Admin positive/negative and step-up tests pass.
- Audit and telemetry redaction are reviewed with representative failures.
- Queue recovery is exercised if queues/workers are used.
- Alerts reach the named owner; the incident and rollback runbooks are
  exercised.

## Phase 7 — live-environment qualification

Status: **planned**

### Steps

1. Resolve OQ-004, OQ-012, OQ-013, and the GitHub/Vercel/Supabase plan
   decisions. Upgrade before launch if pausing, backup, log-retention,
   protection, quota, or support limits conflict with approved objectives.
2. Create a separate live Supabase project in the approved U.S. region. Never
   promote the shared non-production database into the live role.
3. Configure Vercel Production variables separately from Preview. Verify the
   exact project, region, `APP_ENV`, `APP_ORIGIN`, Auth redirects, publishable
   key, server secrets, AI project/key, model IDs, corpus version, and migration
   credentials without recording values.
4. Disable automatic remote database migration. Production migrations run only
   through an owner-protected job against an explicitly verified target.
5. Implement scheduled encrypted logical database export plus a separate
   private-Storage object inventory/export to an off-provider destination.
6. Restore the database and Storage backup into a new isolated project; verify
   Auth-linked state, constraints, RLS, object checksums, corpus rebuild,
   browser flows, and achieved RPO/RTO.
7. Run fictional-data load, concurrency, retry, provider-degradation, cost, and
   quota tests at the expected invited-group scale plus a documented margin.
8. Freeze a release candidate: version, commit SHA, Vercel deployment ID,
   migration list, environment/config version, corpus manifest, model IDs,
   checks, known limitations, rollback deployment, and backup identifiers.
9. Run every applicable gate in
   [Release gates](docs/operations/release-gates.md) and
   [Definition of done](docs/quality/definition-of-done.md), including real
   browser, accessibility, screen-reader, visual, print, Auth/RLS/Storage,
   AI/citation, backup, restore, and rollback evidence.
10. Give the owner the release record and residual-risk list. Qualification
    stops here until the owner explicitly approves the named candidate.

### Exit evidence

- A pinned protected candidate passes the full staging-equivalent matrix.
- Live project configuration exists but no unapproved users/traffic/data are
  enabled.
- Database and Storage restore succeeds within approved objectives.
- No critical/high security issue or missing stop-condition evidence remains.
- The owner approves the exact deployment, commit, migrations, corpus version,
  limitations, and release window.

## Phase 8 — owner-authorized promotion and observation

Status: **planned; do not execute without explicit promotion authorization**

### Steps

1. Check Vercel, Supabase, OpenAI, DNS, and dependency status. Record the live
   baseline and release/rollback identifiers.
2. Freeze changes and corpus ingestion. Create and verify final database and
   Storage backups.
3. Dry-run the exact additive migration set in the protected job. Reconfirm the
   live target and owner approval before apply.
4. Apply the approved migrations, then promote the exact qualified Vercel
   deployment. Do not rebuild from an unreviewed branch.
5. Run read-only health/readiness and authenticated smoke tests with reserved
   fictional qualification accounts: sign-in, role boundary, Home, one
   cleanup-safe incident/report flow, Count Sheet/form, policy citation/source,
   print/export, Account, and logout.
6. Immediately contain or roll back any Auth/RLS/Storage isolation failure,
   sensitive logging, data-integrity symptom, uncited authoritative answer, or
   critical route failure. Do not wait for a percentage threshold.
7. Observe errors, latency, database connections/locks, Auth failures, Storage
   failures, AI failures/latency/cost, quota, and backup signals for at least 15
   minutes and through the first representative invited-user window.
8. Conduct a time-boxed invited-officer evaluation using the approved data
   boundary. This is not an official facility pilot.
9. Keep the prior deployment and legacy system available for the documented
   rollback window. Close the release only after evidence and owner acceptance.
10. Freeze legacy ingestion, reconcile the final approved corpus, and change
    corpus traffic only through
    [Cutover, retirement, and rollback](docs/migration/cutover-retirement-rollback.md).
11. Retire Google Cloud only after exports, independent restore proof, zero
    runtime traffic, billing/IAM review, rollback-window closure, and separate
    destructive-action authorization. Production launch does not authorize
    retirement.

### Exit evidence

- The exact qualified artifact is live and verified in a real browser.
- Monitoring, cost, backup, Auth/RLS/Storage, corpus, and core workflows remain
  healthy through the observation window.
- The release record names the result, exceptions, rollback status, and owner
  acceptance.
- Legacy retirement remains open or is completed under its separate approved
  record.

## Recommended pull-request sequence

Keep each pull request narrow enough to review and roll back independently.

1. **PR-01 — foundation truth and repository gates:** documentation drift, local
   database proof, security/dependency scanning, and repository-control
   decision.
2. **PR-02 — connected Preview and readiness:** Git linkage, environment
   validation, readiness route, remote browser proof.
3. **PR-03 — authentication spike and ADR:** disposable alias lifecycle, threat
   model, accepted/rejected ADR outcome; no user-facing enablement.
4. **PR-04 — identity schema and authorization matrix:** forward migration,
   grants, RLS/Storage policies, generated types, direct negative tests.
5. **PR-05 — sign-in/session/bootstrap vertical slice:** SSR cookies, rate
   limits, revocation, forced change, admin ceremony, browser tests.
6. **PR-06 onward — incident/report slices:** schema/DAL first, then one
   end-to-end user capability per reviewed change.
7. **Forms PRs:** Count Sheet, Daily Paperwork, Monthly packets, Forms Library,
   each with print/output acceptance.
8. **Corpus PRs:** inventory tooling, ingest/extraction, retrieval, generation,
   reader/UI, and evaluations remain separate from restricted source objects.
9. **Operations PRs:** admin/audit, observability, backups, restore drill,
   release automation, and final evidence.

## Immediate owner decisions

The next implementation phase cannot be completed until these are answered in
[`docs/OWNER_DECISIONS.md`](docs/OWNER_DECISIONS.md):

1. Approve `iad1` as the Vercel region paired with Supabase `us-east-1`.
2. Supply a non-sensitive facility display label and URL/domain preference.
3. Confirm Hobby/Free plan eligibility and whether the live Production domain
   needs provider-level protection in addition to application authentication.
4. Choose GitHub Pro branch enforcement or explicitly accept temporary manual
   release controls for the private hobby repository.
5. Approve the personal-passcode policy and administrator MFA/step-up direction.
6. Name the first-admin, reset/unlock, temporary-secret, incident-response,
   backup, billing, and production-approval owners.
7. Identify the authoritative corpus location and the person authorized to
   decide source rights/current versions.
8. Approve recovery objectives, AI budget/circuit breaker, and OpenAI data
   retention posture before Phase 7.

## Stop conditions

Do not promote when any applicable condition is true:

- a required test or release script does not exist;
- the target project, region, migration head, commit, deployment, corpus
  version, or configuration is uncertain;
- authentication, RLS, Storage, cross-user, revocation, bootstrap, or step-up
  negative tests are incomplete;
- a critical/high security issue remains unresolved;
- a migration is destructive, cannot replay cleanly, or breaks the rollback
  application;
- database or Storage recovery is unverified;
- policy source bytes, rights, SHA-256 hashes, versions, page maps, or citation
  evaluation are incomplete;
- preview/live contains unapproved real operational or personnel data;
- browser, accessibility, print, degraded-provider, monitoring, quota, or cost
  evidence is missing;
- a visual baseline was regenerated without review;
- an owner/external gate is missing;
- the requested action would deploy, migrate, change traffic, create accounts,
  import restricted content, or retire infrastructure beyond the authorization
  actually given.

## Provider constraints rechecked on 2026-08-25

- [Vercel deployment protection](https://vercel.com/docs/deployment-protection):
  Hobby Standard Protection covers previews/deployment URLs, not the Production
  domain.
- [Vercel plans](https://vercel.com/docs/plans): Hobby is intended for personal
  projects and has limited runtime-log retention.
- [Supabase production checklist](https://supabase.com/docs/guides/deployment/going-into-prod):
  Free projects may pause for low activity and downloadable managed backups are
  not included.
- [Supabase backups](https://supabase.com/docs/guides/platform/backups): Free
  projects should use logical exports, and database backups do not contain
  Storage objects.
- [GitHub protected branches](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches):
  private-repository protected branches require GitHub Pro, Team, or Enterprise.
- [OpenAI API data controls](https://platform.openai.com/docs/models/default-usage-policies-by-endpoint):
  API inputs/outputs are not used for training by default, but endpoint storage
  and abuse-monitoring retention still require an explicit corpus-use decision.

Recheck these official sources before provisioning or promoting because plans,
quotas, retention, and protection features can change.
