# Security remediation plan review

- **Date:** 2026-09-01
- **Evidence label:** MANUAL (agent-assisted static review of current `main`;
  not an approved penetration test and not a database-verified result)
- **Subject:** `docs/quality/security-remediation-plan.md`, the remediation plan
  written from Codex Security Deep Scan `93a1148f-b3db-4ad9-8402-75a8cb746204`
- **Plan's scanned revision:** `32f6b35a6c537ef83c5cf6da4fc02fff63d9f47e`
- **Revision reviewed here:** `main` at `517ee8d`
- **Source of truth:** `AGENTS.md`, `SECURITY.md`,
  `docs/adr/0003-employee-number-pin-auth.md`

## Verdict

The plan's architecture is right and its four principles are the correct ones
for this codebase. Its **sizing and its baseline are both wrong**, and acting on
it as written would spend most of the effort in the wrong places.

Three corrections must land before this plan drives any work:

1. **The baseline is stale.** The scan ran on `32f6b35a`. `main` is 83 commits
   ahead, and PR #19 (CodeRabbit audit remediation) merged in between and
   already fixed several items the plan lists as open.
2. **The plan proposes building a control this repository already has.** Phase
   1A describes database-enforced session authority as new work. That control
   exists, is proven, and is already applied to 14 of the exposed RPCs. The real
   task is _extending_ it, not inventing it.
3. **The finding count overstates the work.** 54 retained findings map to
   roughly a dozen distinct engineering defects. "Nine concurrent-admission
   findings" is one race condition counted nine times.

Corrected, this is perhaps two weeks of focused work, not a five-phase program.

## What I verified against current `main`

Everything below was checked directly in the tree. Nothing here was accepted
from the scan on its report alone, per the `AGENTS.md` rule that review text is
untrusted.

### Already fixed since the scanned revision — close, do not re-do

| Plan item                                                                           | Status on `main`                  | Evidence                                                                                                                                                                                                              |
| ----------------------------------------------------------------------------------- | --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Phase 3 — "remove unrestricted passthrough fields" from answer-report citations     | **FIXED**                         | `src/server/feedback/answer-report-endpoint.ts:23` is `.strict()`. At `32f6b35a` line 20 was `.passthrough()`.                                                                                                        |
| Phase 3 — "atomic per-account quotas … for answer reports"                          | **FIXED**                         | `supabase/migrations/20260831110000_harden_answer_reports.sql` adds a 32 KiB citation-payload check constraint, a `pg_advisory_xact_lock` on the account, and a 30-per-rolling-hour ceiling raising SQLSTATE `54000`. |
| Phase 3 — "make quota-exceeded behavior observable without exposing sensitive data" | **FIXED**                         | `src/app/api/web/v1/answer-reports/route.ts:21,92` maps `54000` to HTTP 429 `report_limit_reached`.                                                                                                                   |
| Phase 1D — "require `verify-full` … for production database clients"                | **FIXED for policy registration** | `tools/policy-ingestion/guided_policy_ingestion/registration.py:134-153` rejects any `sslmode` other than `verify-full` in Production and preserves a stronger configured DSN.                                        |

The plan's finding-coverage map is therefore inaccurate: at least four of the
items it counts as open are closed, and its Phase 3 entry point should move to
the Count Sheet payload rather than Answer Reports.

### Confirmed still open — these are real

| #   | Plan item                     | Confirmed defect                                                                                                                                                                                                                                                          | Evidence                                                                                                                                  |
| --- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | 1A — stale-token authority    | `app_private.current_active_facility_id()` checks `account.status` and `staff.status` but **never compares JWT `app_metadata.auth_version` to the authoritative row**. A token that survives "sign out everywhere" or a forced passcode change still resolves a facility. | `supabase/migrations/20260826081654_add_incident_create_rpc.sql`; contrast `src/server/auth/current-account.ts:55`, which _does_ compare. |
| 2   | 1A — exposure                 | The Data API exposes the `api` schema, and `jwt_expiry = 3600`, so the enforcement gap is a window of up to one hour.                                                                                                                                                     | `supabase/config.toml:13,165`                                                                                                             |
| 3   | 1C — step-up substitution     | `app_private.admin_step_ups` binds `account_id`, `session_id`, `auth_version` and `purpose` — but **no target ID and no payload digest**. A proof minted to change account A's role can be spent on account B, or to apply a different role than the one approved.        | `supabase/migrations/20260826180000_add_admin_step_ups.sql`                                                                               |
| 4   | Phase 2 — admission race      | The sign-in guard is read → evaluate-in-TypeScript → authenticate → record. Concurrent requests all observe the same pre-state and all pass the gate.                                                                                                                     | `src/server/auth/guarded-employee-sign-in.ts:134-166`                                                                                     |
| 5   | Phase 2 — lockout extension   | Denied attempts are recorded against a `global` subject, so unauthenticated rejected traffic extends a facility-wide window.                                                                                                                                              | same file, lines 127-152                                                                                                                  |
| 6   | 1D — backup tool resolution   | **FIXED IN THIS CHANGE.** `pg_dump` and `age` fell back to a bare name resolved through `PATH` while production credentials and plaintext backup data are in scope.                                                                                                       | `scripts/create-production-backup.mjs:212-213`                                                                                            |
| 7   | Phase 3 — Count Sheet payload | Count Sheet `structure`, `payload` and `validation` are read back as `z.unknown()`.                                                                                                                                                                                       | `src/server/paperwork/count-sheet-revision-history.ts:22,40-42`                                                                           |

### The correction that changes the plan's shape

Phase 1A is written as though database-enforced session authority must be built.
It already exists. Two helpers implement exactly the control the plan describes
— reading `auth.jwt() -> 'app_metadata' -> 'auth_version'`, validating its
shape, and comparing it to the authoritative account row:

- `app_private.current_policy_facility_id()` —
  `supabase/migrations/20260827061000_enforce_policy_rpc_session_authority.sql`
- `app_private.current_daily_paperwork_admin_facility_id()` —
  `supabase/migrations/20260827132000_bind_daily_paperwork_to_session_authority.sql`

Classifying every exposed function by which authority it uses gives the true
scope of the gap:

| Authority                                   | Count | Functions                                                                                                                                                                                                                       |
| ------------------------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Strong** — `auth_version` enforced        | 14    | `current_account`, the seven `*_daily_paperwork_*_v2` functions, `retrieve_policy_passages_v2/v3/v4`, `get_policy_source_reader`, `policy_source_object_is_readable`                                                            |
| **Weak** — status-only or bare `auth.uid()` | 23    | all Count Sheet functions, all report functions, `list_admin_accounts`, `list_admin_audit_events`, `list_staff_selection`, `list_incident_reports`, `report_policy_answer`, and the two superseded v1 daily-paperwork functions |
| Needs individual inspection                 | 8     | the incident functions, `retrieve_policy_passages` (v1), the report-draft-candidate pair                                                                                                                                        |

So 1A is "apply the existing, already-reviewed pattern to the remaining
surfaces" — a bounded migration following two worked examples in the repo — not
a new control with a CI waiver regime.

Two of the weak functions are **dead surface**:
`api.get_daily_paperwork_template` and `api.list_daily_paperwork_status` have no
caller anywhere in `src/`, having been superseded by their `_v2` forms. They
remain executable. Revoking or dropping them is the cheapest risk reduction
available and should go first.

## Where I disagree with the plan

**Phase 2 is over-designed for this system.** The race and the lockout-extension
bug are real and must be fixed. The prescribed cure — a global admission
reservation function, a bounded circuit-breaker with operational alerting, a
shadow-recording rollout comparing decisions and latency, and a
breached-password provider — is a design for a system with many concurrent
users. `AGENTS.md` records this as a private single-facility tool for a few
invited officers. Moving the count-and-insert into one SQL function and scoping
denied unauthenticated traffic off the global subject fixes both defects at a
fraction of the cost. Recommend deferring the circuit-breaker and the
breached-password provider until scope changes.

**Phase 4 conflicts with a recorded owner decision.** It asks for corpus
approval "signed or attested by a separate trusted workflow/identity" and for
approval independent of the code author. `AGENTS.md` states the corpus is
public, is updated once a year by the owner by hand, and that the owner owns the
project completely. There is no second identity to attest, and the plan's own
open question ("Who can attest policy corpus approval … independently of the
code author?") has no answer at this scope. Recommend keeping the _verification_
half — recompute source, extractor-output and checkpoint hashes inside the
importer rather than trusting embedded metadata, which is real and cheap — and
declining the attestation infrastructure until scope changes.

**Phase 3's buffering items are low value here.** Streaming caps on
policy-source downloads guard a path the owner runs by hand, once a year, on
their own machine. Real, but last.

**Phase 0's freeze is an owner call, not an engineering step.** Freezing changes
to authentication, exposed RPCs, backup workflows and policy ingestion is a
decision for the owner to make explicitly, not something to assume.

## Severity note on the two P0 items

Both are worth fixing, and both are narrower than "high" implies for this
deployment:

- The stale-token window (items 1-2) requires an attacker to already hold a
  valid access token. Sessions are held in encrypted, HttpOnly, server-managed
  cookies, so the raw JWT is not casually readable from the browser. This is
  defense in depth against a token that leaks by another route — and it is worth
  having, because the database is the durable boundary and the application-side
  check is currently the only thing enforcing revocation.
- The step-up substitution (item 3) requires the actor to already be an active
  administrator with a live session. It is a confused-deputy and intent-binding
  defect, not a path from unprivileged to administrator.

Neither should be reported to the owner as "the application can be broken into."

## Recommended order

Reordered by (real risk × cost), replacing the plan's Phase 0-5 sequence:

1. **Revoke or drop the two dead v1 daily-paperwork functions.** Pure surface
   reduction, no behavior change.
2. **Extend the existing `auth_version` authority pattern** to the weak
   functions, starting with the report, Count Sheet and admin-list surfaces.
   Follow `20260827061000` as the worked example. Add positive and negative
   pgTAP coverage per surface.
3. **Bind step-up proofs to a target.** Add target ID and an approved-payload
   digest to `app_private.admin_step_ups`, compared during the existing atomic
   consumption. Start with role changes and passcode resets.
4. ~~**Pin the backup tool paths.**~~ **Done in this change** — see "Work
   completed" below.
5. **Collapse the sign-in admission race into one SQL function**, and stop
   letting denied unauthenticated traffic extend the global subject.
6. **Tighten the Count Sheet payload schema**, replacing `z.unknown()` with the
   canonical shape.
7. **Recompute ingestion hashes in the importer** instead of trusting embedded
   checkpoint metadata.
8. **Re-run a complete, uncancelled security scan** against the result. The plan
   is right that a cancelled partial scan is not a release gate.

Items 1, 4 and 6 are independent and can land in any order. Items 2, 3 and 5 all
touch authentication and should land as separate reviewed migrations, never
batched.

## Owner decisions still required

The plan lists five. Three are answered by existing records; two are genuinely
open.

- _"Is direct Supabase Data API access a supported client capability?"_ —
  **Answered by the code.** No browser client exists; every `.rpc()` call in the
  repository is under `src/server/`. However, server calls execute with the
  user's JWT under the `authenticated` role, so the schema cannot simply be
  unexposed. The plan's assumption — enforce authority in SQL — is correct, but
  for a different reason than it gives.
- _"Who can attest policy corpus approval independently of the code author?"_ —
  **Answered by `AGENTS.md`:** nobody, at this scope. Decline the attestation
  work.
- _"Should public preview include facility-specific operational structure?"_ —
  Open, and a genuine product decision.
- _"What login availability tradeoff is acceptable for a global
  circuit-breaker?"_ — Open, but moot if the circuit-breaker is deferred as
  recommended.
- _"What retention/quota budget applies …?"_ — Open. Answer Reports already have
  30/hour; the others need a number.

## Work completed in this change

Only one open item could be both fixed and _verified_ in this environment, so
only that one was implemented. Everything else in the recommended order is a
database migration, and no database can be started here (see the verification
limits below).

**Item 6 — backup tool resolution (plan Phase 1D).**

- `scripts/production-backup-guard.mjs` now rejects any `pg_dump` or `age` path
  that is not absolute, and any path containing a `..` segment. A bare
  executable name is refused, so the tool can no longer be resolved through
  `PATH` while the Production database credential and the plaintext dump stream
  are in scope.
- `scripts/create-production-backup.mjs` no longer defaults the two paths to
  bare `"pg_dump"` and `"age"`. An unset variable now fails the guard instead of
  silently searching `PATH`.
- `toolVersion()` resolves the real path and records the binary's SHA-256
  alongside its version string. The backup evidence therefore names the exact
  binary that handled the credential, and records no secret.
- Every later `spawn` uses that resolved real path, so a symlink swapped between
  verification and use cannot redirect the tool.

Operators must now set `PRODUCTION_BACKUP_PG_DUMP_PATH` and
`PRODUCTION_BACKUP_AGE_PATH` to absolute paths. This is a deliberate breaking
change to the backup runbook: an unpinned invocation that previously worked will
now be rejected before any credential is used.

**Verification run:** `node --test scripts/production-backup-guard.test.mjs` (10
passing, including three new negative cases and a positive case asserting the
valid fixture produces no errors), `npm run test:operations` (69 passing),
`npm run lint`, and `npm run format:check` on the changed files.

## Verification limits of this review

- Static review of source only. No database was started: the Docker daemon is
  unavailable in this environment, so `npm run db:reset`, `npm run db:lint` and
  `npm run db:test` (pgTAP) could not run. **No claim here is
  database-verified**, and none of the recommended migrations may be accepted
  without those gates passing locally.
- No hosted or dynamic testing was performed. The open items in
  `docs/quality/2026-08-30-authentication-security-phase-1-revalidation.md`
  (enumeration timing M-1/L-3, auth DoS M-4, RLS matrix M-9) still require
  hosted evidence and are untouched by this review.
- The underlying scan was cancelled and its inventory marked partial. Absence of
  a finding here is not evidence of absence.
