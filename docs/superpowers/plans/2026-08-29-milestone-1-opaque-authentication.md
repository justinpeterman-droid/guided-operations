# Milestone 1 Opaque Authentication Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the verified no-data Guided Operations foundation into a protected authenticated vertical slice with one fictional administrator, one fictional officer, and a working authenticated dashboard.

**Architecture:** Use employee-number lookup plus application-owned Argon2id credentials and opaque server sessions. Do not send Supabase Auth access/refresh tokens to the browser: Supabase currently requires the `email` claim in access JWTs, so the synthetic-alias SSR design in ADR-0003 cannot satisfy the repository rule that the alias never enters browser storage. Next.js remains the backend-for-frontend; Supabase PostgreSQL stores credential/session metadata behind server-only access, while database grants/RLS remain a second boundary.

**Tech Stack:** Next.js 16.3 App Router, React 19.2, TypeScript 5.9, PostgreSQL 17/Supabase, Zod 4, Vitest 4, Playwright 1.62, Argon2id, server-only PostgreSQL client.

**Spec:** `docs/superpowers/specs/2026-08-28-guided-operations-completion-execution-design.md`

## Global Constraints

- `ROADMAP.md`, `SECURITY.md`, accepted ADRs, and `docs/product/workflow-and-report-safety.md` remain authoritative.
- The release remains a private, non-commercial hobby app for a small invited group of officers; real operational/personnel data is prohibited.
- Employee login is employee number plus an individual passcode; no shared facility code, public signup, email/phone login, or public recovery flow.
- Passcodes for this milestone are 10-64 characters, case-sensitive, not normalized, and may contain printable characters; reject control characters, employee-number equality, repeated/sequence/common values, and known test-fixture weak values. Generated temporary passcodes use 16 characters from an unambiguous letter/digit alphabet.
- Employee numbers are normalized with Unicode NFKC, trim, uppercase, and the existing product-accepted character set before keyed hashing; raw employee numbers never enter logs, audit metadata, browser storage, or durable rate-limit keys.
- Browser session cookies contain only an opaque random application token; no Supabase Auth access/refresh token enters browser storage.
- Session cookie: `go_session`, Secure outside local development, HttpOnly, SameSite=Lax, Path=/, 12-hour absolute lifetime, 60-minute idle lifetime.
- Session secrets rotate after 30 minutes of age with a 30-second previous-secret grace window for concurrent requests; credential/reset/role/status/logout-all changes revoke all affected sessions immediately.
- Administrative elevation lasts at most 15 minutes. Purpose-bound step-up artifacts expire after 5 minutes and are single-use.
- State-changing requests validate authentication, current account state, authorization, Zod input, Origin, Sec-Fetch-Site when present, and a session-bound CSRF token before mutation.
- Server Components perform reads; Server Actions handle internal form mutations; `proxy.ts` may do cheap redirect filtering but is never the authorization boundary.
- The existing applied foundation migration is immutable. All database changes are forward-only.
- Browser code never receives database credentials, peppers, credential hashes, session hashes, AI keys, service-role keys, or unrestricted application-table access.
- No Google Cloud runtime dependency may be introduced.
- Hosted database migration, real identity provisioning, production traffic changes, and merge remain explicit owner gates.

---

### Task 1: Reconcile status truth and replace the failed alias-token design

**Files:**
- Modify: `README.md`
- Modify: `PRODUCT.md`
- Modify: `ARCHITECTURE.md`
- Modify: `SECURITY.md`
- Modify: `ROADMAP.md`
- Modify: `docs/architecture/auth-rbac-rls.md`
- Modify: `docs/adr/0003-employee-number-pin-auth.md`
- Create: `docs/adr/0007-custom-opaque-employee-sessions.md`
- Modify: `docs/OWNER_DECISIONS.md`

**Interfaces:**
- Consumes: verified Vercel foundation evidence in `docs/operations/2026-08-25-hosted-foundation.md`; owner decisions O-012 through O-014.
- Produces: accepted authentication architecture contract used by every later task in this plan.

- [ ] **Step 1: Record the evidence that rejects the standard SSR alias bridge**

In ADR-0003, change the status from `Proposed` to `Rejected` and record the exact incompatibility:

```markdown
## Rejection evidence — 2026-08-29

The preferred server-only alias bridge cannot use Supabase's normal SSR access-token cookie flow without violating this ADR's own alias-invisibility requirement. Supabase documents `email` as a required access-token JWT claim that a Custom Access Token Hook cannot remove. A password-auth user whose internal email-like alias is used for sign-in therefore carries that alias inside the access JWT. Sending that JWT to the browser, even in an HttpOnly cookie, places the alias in browser-held session material.

The product will not weaken the alias-invisibility acceptance criterion. ADR-0007 replaces this proposal with application-owned opaque sessions and credentials.
```

Reference the current official Supabase Custom Access Token Hook and JWT documentation in ADR-0003's references section.

- [ ] **Step 2: Create ADR-0007 with the exact accepted session design**

The ADR must state:

```markdown
- employee number -> keyed SHA-256 lookup digest using EMPLOYEE_LOOKUP_PEPPER
- passcode -> Argon2id hash stored only in app_private.user_credentials
- browser -> opaque `<session-id>.<secret>` cookie only
- database -> only HMAC-SHA256 session-secret digests; never raw session secrets
- Next.js -> validates opaque session and current account status on protected requests
- PostgreSQL -> operation-specific grants/RLS plus current account context as defense in depth
- admin -> 15-minute elevation + 5-minute purpose-bound single-use step-up
- no Supabase Auth user session tokens are used for product authentication
```

Set ADR-0007 to `Accepted` under the owner's standing instruction to use the safest recommended implementation after Option A failed its documented security gate.

- [ ] **Step 3: Reconcile stale hosted-current-state paragraphs**

Update README/PRODUCT/ARCHITECTURE/SECURITY/ROADMAP to state only verified facts:

```text
canonical foundation URL: https://guided-operations.vercel.app
GitHub -> authoritative Vercel project linkage: verified
live foundation page: remotely verified
GET /api/health/live: verified HTTP 200
owner passcode/admin decisions O-012..O-014: recorded
sign-in: still disabled until Milestone 1 implementation passes
real policy corpus: still not imported
operational/personnel data: still prohibited
```

Remove the stale blockers that claim Git linkage/application inspection and OQ-005/OQ-006/OQ-007 are unresolved. Do not mark authentication itself complete.

- [ ] **Step 4: Update the auth/RBAC design for opaque sessions**

Replace `auth.uid()` as the product-session identity source. The target must say the BFF resolves an opaque session to authoritative `user_accounts.id`, sets request account context only after verification, and server-side DAL authorization remains mandatory. Keep default-deny RLS and direct-bypass tests.

- [ ] **Step 5: Verify documentation formatting**

Run:

```bash
npm run format:check
```

Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add README.md PRODUCT.md ARCHITECTURE.md SECURITY.md ROADMAP.md docs/architecture/auth-rbac-rls.md docs/adr/0003-employee-number-pin-auth.md docs/adr/0007-custom-opaque-employee-sessions.md docs/OWNER_DECISIONS.md
git commit -m "docs: select opaque employee authentication"
```

---

### Task 2: Add the forward-only authentication schema and pgTAP security contracts

**Files:**
- Create: `supabase/migrations/20260829090000_opaque_authentication.sql`
- Create: `supabase/tests/authentication.test.sql`
- Modify: `supabase/seed.sql`

**Interfaces:**
- Consumes: foundation tables `app_private.staff_members`, `app_private.user_accounts`, `app_private.audit_events`.
- Produces: `user_accounts.id`, `user_credentials`, `user_sessions`, `auth_rate_limits`, `admin_step_ups`, current-account helper functions, and RLS/grant contracts.

- [ ] **Step 1: Write failing pgTAP assertions before the migration**

Start `authentication.test.sql` with checks that will fail against the current foundation:

```sql
begin;
select plan(18);

select has_column('app_private', 'user_accounts', 'id', 'user_accounts has application id');
select has_table('app_private', 'user_credentials', 'credential table exists');
select has_table('app_private', 'user_sessions', 'session table exists');
select has_table('app_private', 'auth_rate_limits', 'rate-limit table exists');
select has_table('app_private', 'admin_step_ups', 'step-up table exists');
select row_security_active('app_private.user_credentials'::regclass);
select row_security_active('app_private.user_sessions'::regclass);
select row_security_active('app_private.auth_rate_limits'::regclass);
select row_security_active('app_private.admin_step_ups'::regclass);

select * from finish();
rollback;
```

Extend the final file to 18 explicit checks covering RLS, append-only/deny behavior, unique token digests, last-admin protection helper existence, and anon/authenticated having no direct credential/session grants.

- [ ] **Step 2: Run the database test to prove it fails**

Run:

```bash
npm run db:start
npm run db:reset
npm run db:test
```

Expected: `authentication.test.sql` fails because the new schema does not exist.

- [ ] **Step 3: Write the forward migration with a no-account safety assertion**

The migration begins with:

```sql
begin;

do $$
begin
  if exists (select 1 from app_private.user_accounts) then
    raise exception 'opaque authentication migration requires the verified zero-account foundation';
  end if;
end
$$;
```

Refactor the empty foundation `user_accounts` table without editing the applied migration:

```sql
alter table app_private.user_accounts add column id uuid not null default gen_random_uuid();
alter table app_private.user_accounts drop constraint user_accounts_pkey;
alter table app_private.user_accounts add primary key (id);
alter table app_private.user_accounts alter column auth_user_id drop not null;
alter table app_private.user_accounts add constraint user_accounts_auth_user_id_unique unique (auth_user_id);
alter table app_private.user_accounts drop column sign_in_alias;
```

Keep `auth_user_id` nullable only as migration provenance/future compatibility; product authorization must not depend on it.

- [ ] **Step 4: Add credential and opaque-session tables**

Create exact columns:

```sql
create table app_private.user_credentials (
  account_id uuid primary key references app_private.user_accounts(id) on delete cascade,
  passcode_hash text not null check (char_length(passcode_hash) between 40 and 512),
  credential_version integer not null default 1 check (credential_version > 0),
  temporary_expires_at timestamptz,
  changed_at timestamptz not null default statement_timestamp(),
  created_at timestamptz not null default statement_timestamp()
);

create table app_private.user_sessions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references app_private.user_accounts(id) on delete cascade,
  secret_hash text not null unique check (secret_hash ~ '^[a-f0-9]{64}$'),
  previous_secret_hash text check (previous_secret_hash is null or previous_secret_hash ~ '^[a-f0-9]{64}$'),
  previous_valid_until timestamptz,
  auth_version integer not null check (auth_version > 0),
  device_hash text not null check (device_hash ~ '^[a-f0-9]{64}$'),
  network_hash text not null check (network_hash ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default statement_timestamp(),
  rotated_at timestamptz not null default statement_timestamp(),
  last_seen_at timestamptz not null default statement_timestamp(),
  idle_expires_at timestamptz not null,
  absolute_expires_at timestamptz not null,
  revoked_at timestamptz,
  revoke_reason text
);
```

Add indexes on `(account_id, revoked_at)`, `absolute_expires_at`, and `idle_expires_at`.

- [ ] **Step 5: Add rate-limit and step-up tables**

Use keyed digests only:

```sql
create table app_private.auth_rate_limits (
  subject_type text not null check (subject_type in ('account', 'device', 'network', 'global')),
  subject_hash text not null check (subject_hash ~ '^[a-f0-9]{64}$'),
  window_started_at timestamptz not null,
  attempts integer not null default 0 check (attempts >= 0),
  blocked_until timestamptz,
  updated_at timestamptz not null default statement_timestamp(),
  primary key (subject_type, subject_hash)
);

create table app_private.admin_step_ups (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references app_private.user_accounts(id) on delete cascade,
  session_id uuid not null references app_private.user_sessions(id) on delete cascade,
  purpose text not null check (purpose ~ '^[a-z][a-z0-9_.-]{2,80}$'),
  token_hash text not null unique check (token_hash ~ '^[a-f0-9]{64}$'),
  auth_version integer not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default statement_timestamp()
);
```

- [ ] **Step 6: Add default-deny RLS and current-account helpers**

Enable and force RLS on all four new tables. Add `app_private.current_account_id()` that reads `current_setting('app.current_account_id', true)` and returns null when absent or malformed. Add narrow self-read policies only where the runtime role needs them; credential hashes, session hashes, rate-limit rows, and step-up hashes never become browser/Data API DTOs.

- [ ] **Step 7: Keep local seed unmistakably fictional**

Do not seed real accounts or passcodes. Seed only the existing fictional facility/staff records needed for tests, and create credential/session rows inside test transactions instead of durable seed where possible.

- [ ] **Step 8: Run the database gate**

Run:

```bash
npm run db:reset
npm run db:lint
npm run db:test
```

Expected: migration replay succeeds, lint exits 0, pgTAP exits 0.

- [ ] **Step 9: Commit**

```bash
git add supabase/migrations/20260829090000_opaque_authentication.sql supabase/tests/authentication.test.sql supabase/seed.sql
git commit -m "feat: add opaque authentication schema"
```

---

### Task 3: Add server-only cryptographic and database primitives

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `.env.example`
- Create: `src/lib/env/auth-server.ts`
- Create: `src/server/db/runtime.ts`
- Create: `src/server/auth/employee-number.ts`
- Create: `src/server/auth/passcode.ts`
- Create: `src/server/auth/tokens.ts`
- Create: `src/server/auth/csrf.ts`
- Create: `src/server/auth/__tests__/employee-number.test.ts`
- Create: `src/server/auth/__tests__/passcode.test.ts`
- Create: `src/server/auth/__tests__/tokens.test.ts`

**Interfaces:**
- Produces: `normalizeEmployeeNumber`, `employeeLookupDigest`, `hashPasscode`, `verifyPasscode`, `issueOpaqueToken`, `hashOpaqueSecret`, `deriveCsrfToken`, `createRuntimeDb`.

- [ ] **Step 1: Add failing unit tests for normalization, passcodes, and token hashing**

Required cases:

```ts
expect(normalizeEmployeeNumber("  ab-123  ")).toBe("AB-123");
expect(() => normalizeEmployeeNumber("\u0000bad")).toThrow();
expect(validateNewPasscode("AB-123", "AB-123").success).toBe(false);
expect(validateNewPasscode("AB-123", "aaaaaaaaaa").success).toBe(false);
expect(validateNewPasscode("AB-123", "CorrectHorse9").success).toBe(true);
expect(issueOpaqueToken().secret).toMatch(/^[A-Za-z0-9_-]{43}$/);
expect(hashOpaqueSecret("secret")).toMatch(/^[a-f0-9]{64}$/);
```

- [ ] **Step 2: Run the focused tests and confirm failure**

Run:

```bash
npm test -- src/server/auth/__tests__
```

Expected: fail because modules do not exist.

- [ ] **Step 3: Add reviewed dependencies**

Install a maintained Argon2id implementation and a small PostgreSQL client compatible with Node/Vercel server runtime:

```bash
npm install @node-rs/argon2 postgres
```

Record the resolved locked versions in the PR and run dependency review before merge.

- [ ] **Step 4: Define server-only environment parsing**

Add to `.env.example`:

```dotenv
APP_DATABASE_URL=
SESSION_TOKEN_PEPPER=
AUTH_SUBJECT_PEPPER=
CSRF_TOKEN_PEPPER=
```

`auth-server.ts` uses Zod and `server-only`; each pepper requires at least 32 bytes of encoded entropy. Never expose them through `NEXT_PUBLIC_` variables.

- [ ] **Step 5: Implement employee-number lookup primitives**

Use Node `crypto.createHmac("sha256", pepper)` after NFKC/trim/uppercase normalization. Raw employee numbers are never returned from logging helpers.

- [ ] **Step 6: Implement Argon2id passcode hashing**

Use Argon2id with a 64 MiB memory cost, time cost 3, parallelism 1, and 32-byte output. Keep exact passcode bytes case-sensitive and unnormalized. Reject 10+ repeated identical characters, obvious ascending/descending digit sequences, employee-number equality, and the repository's small denylist fixture before hashing.

- [ ] **Step 7: Implement opaque session and CSRF primitives**

`issueOpaqueToken()` returns `{ id: crypto.randomUUID(), secret: randomBytes(32).toString("base64url") }`.

The cookie value format is:

```text
<uuid>.<43-char-base64url-secret>
```

Store only `HMAC-SHA256(SESSION_TOKEN_PEPPER, secret)` in PostgreSQL. Derive CSRF as `HMAC-SHA256(CSRF_TOKEN_PEPPER, "csrf:" + sessionId + ":" + secret)` and compare with `timingSafeEqual`.

- [ ] **Step 8: Add the server-only PostgreSQL runtime client**

Use `postgres(APP_DATABASE_URL, { max: 1, prepare: false, idle_timeout: 20, connect_timeout: 10 })`. The runtime URL must use the future least-privilege runtime login, not the `postgres` owner connection or Supabase service role.

- [ ] **Step 9: Run focused and broad TypeScript tests**

Run:

```bash
npm test -- src/server/auth/__tests__
npm run typecheck
npm run lint
```

Expected: all exit 0.

- [ ] **Step 10: Commit**

```bash
git add package.json package-lock.json .env.example src/lib/env/auth-server.ts src/server/db/runtime.ts src/server/auth
git commit -m "feat: add authentication security primitives"
```

---

### Task 4: Implement credential verification, abuse controls, and opaque session lifecycle

**Files:**
- Create: `src/server/auth/types.ts`
- Create: `src/server/auth/repository.ts`
- Create: `src/server/auth/rate-limit.ts`
- Create: `src/server/auth/session.ts`
- Create: `src/server/auth/service.ts`
- Create: `src/server/auth/__tests__/rate-limit.test.ts`
- Create: `src/server/auth/__tests__/session.test.ts`
- Create: `src/server/auth/__tests__/service.test.ts`

**Interfaces:**
- Produces: `authenticateEmployee`, `requireCurrentSession`, `rotateSessionIfNeeded`, `logoutSession`, `logoutAllSessions`, `changeOwnPasscode`, `unlockAccount`.

- [ ] **Step 1: Write service tests with a fake repository**

Cover unknown account, wrong passcode, locked account, disabled account, forced-change account, successful session creation, expired session, idle expiry, auth-version mismatch, rotation grace, logout, logout-all, and credential-change revocation.

All login failures use one public result:

```ts
{ ok: false, code: "invalid_credentials", message: "Unable to sign in with those credentials." }
```

Rate limiting may instead return generic `rate_limited` with no account-existence detail.

- [ ] **Step 2: Verify tests fail before implementation**

Run:

```bash
npm test -- src/server/auth/__tests__/service.test.ts src/server/auth/__tests__/session.test.ts src/server/auth/__tests__/rate-limit.test.ts
```

Expected: fail because service/repository do not exist.

- [ ] **Step 3: Implement constant-path credential verification**

`authenticateEmployee` must:

```text
normalize -> hash employee lookup -> evaluate account/device/network/global rate limits -> load one matching credential row OR dummy hash -> Argon2 verify -> recheck account status -> record success/failure -> create opaque session -> return minimal actor DTO
```

Use a committed non-secret valid Argon2id dummy hash for missing-account verification so unknown accounts still perform password verification work.

- [ ] **Step 4: Implement bounded lockout**

Use five failures inside 15 minutes as the first account lock threshold, then exponential lock durations capped at 15 minutes. Keep device/network/global limits separate so an attacker cannot permanently disable an account by knowing its employee number.

- [ ] **Step 5: Implement session validation and rotation**

A session is valid only when:

```text
row exists
AND not revoked
AND now < idle_expires_at
AND now < absolute_expires_at
AND account.status = active
AND session.auth_version = account.auth_version
AND current secret hash matches OR previous hash is within 30-second grace
```

Rotate the secret after 30 minutes; update `previous_secret_hash`, `previous_valid_until`, `secret_hash`, and `rotated_at` atomically.

- [ ] **Step 6: Implement logout-all and credential-change revocation**

Credential reset/change, role change, disable, and logout-all increment `auth_version` and revoke all existing session rows for the account in the same database transaction.

- [ ] **Step 7: Run focused tests**

Run:

```bash
npm test -- src/server/auth/__tests__
```

Expected: all auth unit tests pass.

- [ ] **Step 8: Commit**

```bash
git add src/server/auth
git commit -m "feat: implement opaque session lifecycle"
```

---

### Task 5: Implement bootstrap, administrator step-up, and minimal account lifecycle

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `scripts/bootstrap-admin.ts`
- Create: `src/server/auth/admin.ts`
- Create: `src/server/auth/__tests__/admin.test.ts`
- Create: `docs/operations/first-admin-bootstrap.md`

**Interfaces:**
- Produces: `bootstrapFirstAdmin`, `beginAdminStepUp`, `consumeAdminStepUp`, `createOfficerAccount`, `resetAccountPasscode`, `setAccountStatus`, `setAccountRole`.

- [ ] **Step 1: Write tests for bootstrap and last-admin protection**

Cover zero-account success, second bootstrap rejection, generated temporary passcode, forced-change flag, last-admin disable rejection, last-admin demotion rejection, reset revoking sessions, unlock clearing lock state, wrong/expired/replayed step-up rejection.

- [ ] **Step 2: Verify tests fail**

Run:

```bash
npm test -- src/server/auth/__tests__/admin.test.ts
```

Expected: fail because admin service does not exist.

- [ ] **Step 3: Implement first-admin bootstrap under an advisory lock**

`bootstrapFirstAdmin` takes employee number and display name, but **not** a passcode. It acquires a transaction advisory lock, proves zero accounts exist, generates a 16-character temporary passcode, creates fictional/admin staff+account+credential rows, writes a redacted audit event, and returns the temporary passcode only to the caller.

- [ ] **Step 4: Add an operator-only bootstrap command**

Add `tsx` as a development dependency and:

```json
"auth:bootstrap-admin": "tsx scripts/bootstrap-admin.ts"
```

The script refuses to run when `CI` is set or `process.stdout.isTTY` is false. It prints the generated temporary passcode exactly once to the interactive terminal and never writes it to a file or log.

- [ ] **Step 5: Implement admin elevation and purpose-bound step-up**

Elevation requires re-verifying the administrator's current passcode and is represented only in the current session server state. A high-impact operation issues a random step-up token bound to account, session, auth_version, and exact purpose; store only its hash; consume it atomically once within 5 minutes.

- [ ] **Step 6: Implement minimal account lifecycle services**

Account creation always generates a temporary passcode and forces first change. Reset, disable, role change, unlock, and logout-all are audited with allowlisted metadata only and require the correct purpose-bound step-up.

- [ ] **Step 7: Document bootstrap operator procedure**

The runbook must include prerequisites, exact command, fictional-data restriction, one-time credential handling, failure recovery, and proof that no credential appears in GitHub Actions/Vercel logs.

- [ ] **Step 8: Run focused tests and type checks**

Run:

```bash
npm test -- src/server/auth/__tests__/admin.test.ts
npm run typecheck
npm run lint
```

Expected: all exit 0.

- [ ] **Step 9: Commit**

```bash
git add package.json package-lock.json scripts/bootstrap-admin.ts src/server/auth/admin.ts src/server/auth/__tests__/admin.test.ts docs/operations/first-admin-bootstrap.md
git commit -m "feat: add protected account bootstrap and lifecycle"
```

---

### Task 6: Wire login, forced passcode change, logout, proxy filtering, and the first dashboard

**Files:**
- Create: `src/features/auth/schemas.ts`
- Create: `src/features/auth/actions.ts`
- Create: `src/features/auth/sign-in-form.tsx`
- Create: `src/features/auth/change-passcode-form.tsx`
- Create: `src/features/auth/__tests__/sign-in-form.test.tsx`
- Create: `src/features/auth/__tests__/change-passcode-form.test.tsx`
- Modify: `src/app/page.tsx`
- Create: `src/app/account/change-passcode/page.tsx`
- Create: `src/app/home/page.tsx`
- Create: `src/app/home/loading.tsx`
- Create: `proxy.ts`

**Interfaces:**
- Consumes: `authenticateEmployee`, `requireCurrentSession`, `changeOwnPasscode`, `logoutSession`, `deriveCsrfToken`.
- Produces: the first real end-to-end authenticated product surface.

- [ ] **Step 1: Read the version-matched Next.js 16.3 docs before code**

Read the installed documentation for Server Actions, `cookies()`, `redirect()`, caching/no-store, and `proxy.ts`. Follow repository `AGENTS.md`; do not substitute memorized Next.js APIs.

- [ ] **Step 2: Write component/action tests first**

Tests cover enabled sign-in fields, generic failure text, pending state, 429 guidance, forced-change redirect, invalid new passcode validation, and successful dashboard redirect.

- [ ] **Step 3: Verify tests fail**

Run:

```bash
npm test -- src/features/auth
```

Expected: fail because auth feature UI/actions do not exist.

- [ ] **Step 4: Implement the sign-in Server Action**

The action validates Zod input, normalizes the employee number server-side, calls `authenticateEmployee`, sets `go_session` with the exact cookie contract, and redirects to `/account/change-passcode` when `must_change_passcode` is true; otherwise redirect to `/home`.

Never return a raw employee number, credential hash, session token, device/network digest, or account-existence distinction to the Client Component.

- [ ] **Step 5: Replace the disabled foundation form with the working sign-in form**

Preserve the approved foundation visual direction and copy, but remove the inaccurate `being connected`/disabled state once the backend gate exists. Keep explicit fictional/hobby boundary copy outside the credential form.

- [ ] **Step 6: Implement forced passcode change**

The page is accessible only to a valid session requiring a passcode change. It includes the session-bound CSRF token, validates Origin/Sec-Fetch-Site in the action, changes the hash, increments auth_version, revokes old sessions, issues one new session, and redirects to `/home`.

- [ ] **Step 7: Implement protected `/home`**

`/home` is a Server Component. It calls `requireCurrentSession()` and renders only a minimal trusted actor DTO: display name, role, and safe session state. Use this as the authenticated dashboard foundation; do not invent incident/report/demo records.

- [ ] **Step 8: Add `proxy.ts` as a convenience redirect gate**

Proxy may check only whether the opaque session cookie is syntactically present and redirect obviously unauthenticated `/home` and `/account/*` requests to `/`. It must not query the database or be described as authorization.

- [ ] **Step 9: Add logout**

Logout is a POST/Server Action with Origin+CSRF checks, revokes the current database session, clears `go_session`, and redirects to `/`.

- [ ] **Step 10: Run component, type, lint, and build gates**

Run:

```bash
npm test -- src/features/auth
npm run typecheck
npm run lint
npm run build
```

Expected: all exit 0.

- [ ] **Step 11: Commit**

```bash
git add src/features/auth src/app/page.tsx src/app/account src/app/home proxy.ts
git commit -m "feat: enable secure employee sign in"
```

---

### Task 7: Prove database, browser, abuse, and authorization behavior end to end

**Files:**
- Create: `e2e/authentication.spec.ts`
- Modify: `playwright.config.ts` if needed for the existing project convention
- Modify: `supabase/tests/authentication.test.sql`
- Modify: `docs/quality/testing.md` or the existing authentication-test section under `docs/quality/`
- Modify: `ROADMAP.md`
- Modify: `docs/operations/2026-08-25-hosted-foundation.md`

**Interfaces:**
- Produces: Milestone 1 release evidence; does not itself authorize a hosted migration or production identity.

- [ ] **Step 1: Add Playwright coverage for the complete fictional flow**

Use a fictional administrator and fictional officer only. Required browser cases:

```text
unknown employee + wrong passcode -> same generic error
known employee + wrong passcode -> same generic error
rate limit -> generic retry response
first admin -> forced passcode change -> home
admin creates fictional officer -> temp passcode -> forced change -> home
disabled account -> existing session denied
logout -> cookie cleared -> protected page redirected
logout-all -> second browser context denied
role/status change -> stale session denied
CSRF missing/wrong -> mutation rejected
cross-site Origin -> mutation rejected
keyboard-only sign-in/change/logout works
mobile 390x844 and desktop 1440x900 have no overflow or console errors
```

- [ ] **Step 2: Expand pgTAP to direct-bypass denial cases**

Verify anon/authenticated cannot directly select credential/session/rate-limit/step-up rows; missing request context returns no protected rows; a different current account context cannot read another account's protected self rows.

- [ ] **Step 3: Run the full local database gate**

Run:

```bash
npm run db:reset
npm run db:lint
npm run db:test
```

Expected: all exit 0.

- [ ] **Step 4: Run the full web gate**

Run:

```bash
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
```

Expected: all exit 0 with no console/security failures in the auth scenarios.

- [ ] **Step 5: Update the roadmap with evidence, not claims**

Mark only the gates actually proven locally. Keep hosted migration, Vercel environment secrets, runtime database-role password, hosted identities, and production traffic as explicit owner-authorized follow-up actions.

- [ ] **Step 6: Update Issue #2**

Post a concise milestone note containing the commit, passed gates, remaining external owner gates, and next blocker. Do not close the master goal.

- [ ] **Step 7: Commit**

```bash
git add e2e supabase/tests docs/quality ROADMAP.md docs/operations/2026-08-25-hosted-foundation.md
git commit -m "test: qualify milestone 1 authentication"
```

---

## Hosted activation gate after local implementation

Do **not** perform these steps automatically. They require explicit owner authorization because they change hosted security/data configuration:

1. Apply the reviewed forward migration to the designated non-production Supabase project.
2. Provision the least-privilege runtime database login and set its password outside Git; configure `APP_DATABASE_URL` in the Vercel Preview environment.
3. Generate and configure `SESSION_TOKEN_PEPPER`, `AUTH_SUBJECT_PEPPER`, and `CSRF_TOKEN_PEPPER` in Vercel's secret store.
4. Run the first-admin bootstrap with a fictional administrator only.
5. Create one fictional officer account through the protected admin flow.
6. Verify the exact reviewed commit in a protected Vercel Preview, desktop and mobile.
7. Re-run login/session/disable/logout-all/CSRF checks against the hosted Preview.
8. Only after that evidence, update ADR-0007/ROADMAP/Issue #2 with hosted qualification.

## Plan Self-Review

- **Spec coverage:** This plan covers the approved Milestone 1 sequence: status reconciliation, failed Option A handling, authentication/session implementation, RLS/grants, first-admin bootstrap, fictional officer, protected dashboard, and browser/security evidence.
- **No speculative product scope:** Incident/report, forms, RAG, and final administrator command-center work remain later roadmap milestones.
- **Security boundary:** No step weakens alias invisibility, fictional-data restrictions, current-account rechecks, RLS/grants, step-up, audit redaction, or explicit hosted/merge owner gates.
- **Type/interface continuity:** Later tasks consume the exact named primitives produced by Tasks 3-5; the UI never receives credential/session internals.
- **External dependency:** GitHub Actions currently fails before runner assignment on PR #3; this plan does not treat that infrastructure failure as a passing repository gate or authorize bypassing it.
