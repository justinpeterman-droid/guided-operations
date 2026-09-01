# Guided Operations security remediation plan

## Scope and evidence limits

This is a remediation plan for the retained output of Codex Security Deep Scan
`93a1148f-b3db-4ad9-8402-75a8cb746204`, against revision
`32f6b35a6c537ef83c5cf6da4fc02fff63d9f47e`. The scan was cancelled after nine
independent reviews and its inventory was marked partial. It retained 54
reportable findings: 8 high, 39 medium, and 7 low. The plan therefore treats
every item below as an open engineering risk, not as a final statement that the
repository has no additional issues.

The working tree still points to the scanned commit, but has three untracked
local scripts. Do not fold those scripts into this work without separate review.

## Remediation strategy

Address the risks through a small number of owned controls instead of applying
54 unrelated patches. The recommended design is to move security decisions to
durable boundaries that the application cannot accidentally bypass:

1. database-enforced session authority for every exposed RPC;
2. atomic, target-bound state machines for credential and privileged actions;
3. atomic admission and bounded storage for abuse-sensitive operations;
4. trusted, pinned release and policy-ingestion evidence.

Each phase must land with its own migration, focused tests, rollback path, and
security review. No production deployment, database migration, or secret change
is authorized by this document.

## Finding coverage map

| Workstream                                    | Retained findings covered                                                                                                           | Priority |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | -------- |
| Session authority and Data API enforcement    | 3 high stale-token findings plus 2 medium stale-token write findings                                                                | P0       |
| Credential lifecycle and admin intent binding | 2 high step-up findings; 2 high and 5 medium temporary-passcode/re-authentication findings                                          | P0       |
| Sign-in admission and lockout design          | 9 concurrent-admission findings, 6 lockout/global-counter findings, 4 re-authentication abuse findings, and 1 weak-passcode finding | P1       |
| Durable operational input governance          | 4 answer-report, 1 Count Sheet JSON, 3 policy-download buffering, 1 AI response-buffer, and 2 ingestion-resource findings           | P1       |
| Trusted policy and release operations         | 1 corpus self-attestation, 1 mutable ingestion-checkpoint, 1 database TLS, 1 backup-tool, and 1 workflow-candidate-code finding     | P0/P1    |
| Exposure and response-quality policy          | 1 public preview disclosure and 1 citation-grounding finding                                                                        | P2       |

Duplicates retained by the cancelled Deep Scan should be closed only after the
shared control and its original attack path are independently revalidated.

## Phase 0 — establish the change boundary

**Owner:** security lead with the application and database owners.  
**Exit evidence:** an approved remediation branch plan, a local Supabase test
environment using fictional data, and a verified inventory of all
`SECURITY DEFINER` functions and grants.

- Freeze nonessential changes to authentication, exposed Supabase RPCs,
  production backup/migration workflows, and policy ingestion until their owning
  workstream has a reviewer.
- Create a finding-to-test ledger that records the retained finding ID, affected
  route/RPC, owner, migration, regression test, rollout gate, and rollback
  commit.
- Treat the 823-file scan as incomplete: repeat a fresh complete security scan
  after the P0/P1 work is accepted. Do not use the cancelled scan to declare
  release readiness.

## Phase 1 — close the high-risk authorization and credential paths

### 1A. Enforce current session authority inside every exposed Data API RPC

**Owner:** database/auth owner.  
**Addresses:** revoked administrator token reads; revoked JWT direct-RPC access;
revoked-token incident creation.

- Add one private SQL authority helper that verifies `auth.uid()`, active
  account/staff state, JWT `app_metadata.auth_version`, authoritative
  `user_accounts.auth_version`, and the pending-revocation window.
- Require that helper at the opening of every authenticated `api.*` function,
  including read, mutation, admin, incident, report, Count Sheet, Policy Expert,
  and feedback RPCs. Do not rely on the Next.js session gate for direct Data API
  access.
- Build a migration-time inventory test: any `authenticated` executable
  `SECURITY DEFINER` function without the helper must fail CI unless explicitly
  waived with a reviewed reason.
- Test with an old access JWT after logout-all, forced passcode change,
  disablement, and role change. Verify both reads and writes are denied before
  provider token expiry.

**Rollback:** a reversible migration that restores the prior function
definitions; do not roll back while a stale-token incident is unresolved.

### 1B. Make temporary-passcode completion a recoverable ceremony

**Owner:** auth owner.  
**Addresses:** password update before identity/expiry checks; success reported
after failed global sign-out; expired temporary passcodes changing credentials.

- First atomically reserve and validate the unexpired, one-time employee proof
  in private Postgres state; only then call the provider password update.
- Keep a durable `pending`/`provider-updated`/`revocation-confirmed` state so
  retries reconcile safely rather than replaying or falsely completing the
  ceremony.
- Check returned provider errors, not only thrown exceptions. Keep application
  authority fail-closed while global provider revocation is pending.
- Reuse this ceremony for equivalent credential lifecycle transitions instead of
  creating another bespoke flow.

**Acceptance tests:** invalid employee number, expired temporary passcode,
duplicate completion, provider update failure, non-throwing sign-out error,
retry after a transient provider failure, and old refresh-token denial.

### 1C. Bind administrator step-up proofs to the exact action

**Owner:** auth and admin-route owners.  
**Addresses:** both high administrator step-up substitution findings.

- Replace purpose-only proof issuance with a canonical action descriptor: action
  type, target ID, facility when relevant, and a digest of the approved
  security-relevant payload.
- Persist those values with the proof and compare them during one atomic
  consumption operation. Every route must construct the descriptor before asking
  for reauthentication.
- Start with role changes, passcode resets, retention execution, and legal-hold
  release; inventory all remaining consumers before declaring the shared API
  complete.

**Acceptance tests:** a proof issued for account A cannot change account B; a
proof for one role cannot apply a different role; a proof cannot be reused,
replayed across sessions, or consumed after auth-version change.

### 1D. Make production database connections and tools authentic

**Owner:** release/platform owner.  
**Addresses:** production database TLS identity finding and backup-tool
execution finding.

- Require `verify-full` and an approved CA certificate for production database
  clients; reject `require` and `verify-ca` in migration and backup guards.
- Invoke database tools through a pinned, allowlisted absolute path or a
  digest-pinned trusted runner. Do not search `PATH` while credentials or
  plaintext backups are available.
- Add a preflight that records the selected binary version, binary hash, server
  certificate identity, and target project reference without recording secrets.

**Exit evidence:** a dry-run against a non-production protected fixture
demonstrates rejection of a wrong host, wrong CA, wrong binary, and untrusted
TLS chain.

## Phase 2 — redesign authentication admission rather than patching counters

**Owner:** auth/database owner.  
**Addresses:** all nine concurrent sign-in admission findings, three sustained
global-lockout findings, three denied-traffic lockout-extension findings, the
shared global allowance finding, four unthrottled reauthentication findings, and
the common-passcode finding.

- Replace read/evaluate/authenticate/insert with a single PostgreSQL
  admission/reservation function. It locks account, device, network, and global
  subject keys in a stable order, records the current reservation before
  provider verification, and finalizes the outcome without reopening the gate.
- Separate per-account protection from facility availability. Do not let
  unauthenticated rejected traffic indefinitely extend a facility-wide lockout;
  use a bounded global circuit-breaker with expiry and operational alerting
  instead.
- Give fresh-passcode verification for step-up and personal passcode changes its
  own account-aware reservation policy. Keep generic public responses and
  HMAC-derived subject identifiers.
- Add a documented common-password/breached-password policy appropriate for
  offline or provider-backed enforcement; confirm privacy and availability
  implications before choosing the provider.
- Add retention/compaction for attempt events so denied traffic cannot create
  unlimited metadata.

**Acceptance tests:** concurrent requests across multiple application processes
never exceed the configured account/device/network allowance; one account cannot
lock out others; denied traffic expires predictably; provider errors reconcile
reservations; reauthentication attempts are bounded without leaking account
state.

**Rollout:** shadow-record reservations first, compare decisions and latency,
then enforce per-account/device/network before enabling any global
circuit-breaker.

## Phase 3 — bound durable operational inputs and review queues

**Owner:** application/data owners.  
**Addresses:** all answer-report, Count Sheet JSON, policy-source buffering, AI
response-buffering, and policy-ingestion resource findings.

- Define canonical schemas for answer-report citations and Count Sheet payloads.
  Remove unrestricted passthrough fields; validate depth, item count, total
  serialized bytes, and known field lengths before persistence.
- Add atomic per-account and per-facility quotas, idempotency, duplicate
  suppression, retention, and review-queue backpressure for answer reports. Make
  quota-exceeded behavior observable without exposing sensitive data.
- Store a normalized operational representation or a bounded, versioned
  document; do not persist opaque unbounded JSON as the sole record of a Count
  Sheet.
- Stream policy-source downloads with a verified byte cap and abort handling
  instead of full buffering. Set a maximum response size before parsing
  AI-provider responses.
- For policy ingestion, add document/page/output size limits, extraction
  timeouts, subprocess memory/CPU limits, a bounded concurrency queue, and
  cleanup of failed intermediate artifacts.

**Acceptance tests:** maximum-size nested payloads are rejected or clipped
deterministically; repeated submissions return the original idempotent result;
multiple concurrent downloads do not exceed the memory budget; oversized/slow AI
and extraction responses fail closed with useful operations telemetry.

## Phase 4 — make policy and release evidence independently verifiable

**Owner:** policy-ingestion and release owners.  
**Addresses:** corpus self-attestation, mutable ingestion checkpoint, production
workflow candidate-code, and remaining release-tool findings.

- Replace self-asserted corpus approval/scan metadata with a detached, immutable
  approval record signed or attested by a separate trusted workflow/identity.
  Verify that record against the exact source hash before import.
- Recompute source, extractor-output, and checkpoint hashes inside the importer;
  never trust a mutable checkpoint merely because its embedded metadata claims
  prior approval.
- Run production database workflows only from a protected, reviewed automation
  revision. Separate the code that handles production secrets from arbitrary
  pull-request/candidate checkout code; pin action and container/tool references
  by immutable digest.
- Retain auditable, secret-free receipts for approval, source digest, extractor
  version, migration head, and backup verification.

**Acceptance tests:** edited checkpoint bytes, forged approval fields, unsigned
corpus manifests, a changed workflow candidate, and an unpinned binary all fail
before credentials or production data are used.

## Phase 5 — decide intentional exposure and answer-quality policy

**Owner:** product owner with security review.  
**Addresses:** public Count Sheet structure disclosure and policy-answer
citation mismatch.

- Decide whether facility-specific Count Sheet structure belongs in public
  previews. If not, use a generic fictional structure or put the route behind
  the same audience gate as operational content.
- Tighten Policy Expert grounding so each material claim is mapped to supporting
  citation spans, not merely to authentic citations somewhere in the answer.
  Prefer refusal/uncertainty when claim support is incomplete.
- Document the chosen disclosure and answer-quality boundaries in product and
  release criteria.

## Delivery order and release gates

1. Complete Phase 0 and agree on control owners.
2. Ship 1A, 1B, and 1C together in an auth/RPC release train; ship 1D separately
   with a non-production dry run.
3. Ship Phase 2 only after its concurrency test harness runs against local
   Supabase and multiple server processes.
4. Ship Phase 3 in bounded slices, beginning with Answer Reports and Count Sheet
   persistence.
5. Ship Phase 4 before the next production migration, backup, or policy corpus
   import.
6. Resolve Phase 5 with an owner decision before any public preview or
   policy-answer expansion.
7. Run migration replay, RLS/grant tests, focused route tests, load/concurrency
   tests, and a fresh full security scan. A cancelled partial scan is not a
   release gate.

## Decisions needed before implementation

- Is direct Supabase Data API access a supported client capability, or should
  the architecture restrict it behind the application server? The plan assumes
  it remains supported and therefore enforces session authority in SQL.
- What login availability tradeoff is acceptable for a global abuse
  circuit-breaker? The plan recommends protecting individual accounts without
  allowing one remote actor to create a facility-wide outage.
- What retention/quota budget applies to feedback, Count Sheets, downloads, AI
  responses, and policy-ingestion artifacts?
- Who can attest policy corpus approval and release tooling independently of the
  code author?
- Should public preview include any facility-specific operational structure?

## Completion criteria

The plan is complete only when every retained finding is either independently
revalidated as fixed, accepted with an owner-approved compensating control, or
superseded by a new complete scan. No item should be closed based only on a code
review or on this planning document.
