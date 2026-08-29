# Milestone 1 Opaque Authentication Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the verified no-data Guided Operations foundation into a protected authenticated vertical slice with one fictional administrator, one fictional officer, and a working authenticated dashboard.

**Architecture:** Use application-owned Argon2id credentials and opaque sessions. The preferred Supabase Auth alias + SSR-token design is rejected because Supabase documents `email` as a required access-token JWT claim; sending that JWT to the browser would place the synthetic alias in browser-held session material, violating ADR-0003's alias-invisibility rule. Next.js remains the BFF. A dedicated pre-auth database role can execute only two lookup/rate-limit functions; a separate authenticated runtime database role operates under a verified `app.current_account_id` request context and RLS. Browser cookies contain only an opaque application session token.

**Tech Stack:** Next.js 16.3 App Router, React 19.2, TypeScript 5.9, PostgreSQL 17/Supabase, Zod 4, Vitest 4, Playwright 1.62, Argon2id, `postgres` server-only PostgreSQL client.

**Spec:** `docs/superpowers/specs/2026-08-28-guided-operations-completion-execution-design.md`

## Global Constraints

- `ROADMAP.md`, `SECURITY.md`, accepted ADRs, and `docs/product/workflow-and-report-safety.md` remain authoritative.
- This remains a private, non-commercial hobby release. Real incident, inmate, roster, report, personnel, and operational-paperwork data are prohibited.
- Employee login is employee number + individual passcode. No shared code, email/phone login, public signup, or public recovery.
- Passcodes are 10-64 characters, case-sensitive, exact-byte input with no normalization; reject control characters, employee-number equality, repeated/sequence/common values, and repository weak-value fixtures. Generated temporary passcodes are 16 characters from an unambiguous letter/digit alphabet.
- Employee numbers use NFKC + trim + uppercase before keyed SHA-256 lookup hashing. Raw employee numbers never enter logs, audit metadata, browser storage, or durable rate-limit keys.
- Browser authentication cookie: `go_session=<uuid>.<43-char-base64url-secret>`, Secure outside local development, HttpOnly, SameSite=Lax, Path=/, 12-hour absolute lifetime, 60-minute idle lifetime.
- Store only HMAC-SHA256 session-secret digests. Rotate after 30 minutes with a 30-second previous-secret grace window for concurrent requests.
- Credential reset/change, role/status change, disable, and logout-all increment `auth_version` and revoke affected sessions in the same transaction.
- Admin elevation lasts 15 minutes. High-impact action step-up expires after 5 minutes, is purpose-bound, and is consumed once.
- State-changing requests validate session, current account state, authorization, Zod input, Origin, Sec-Fetch-Site when present, and a session-bound CSRF token before mutation.
- Server Components perform protected reads. Server Actions handle internal form mutations. `proxy.ts` may do cheap redirect filtering but is never authorization.
- The applied `20260825125137_foundation.sql` migration is immutable. Changes are forward-only.
- No browser bundle receives database URLs, peppers, hashes, AI secrets, service-role keys, or unrestricted table access.
- No Google Cloud runtime dependency may be introduced.
- Hosted migrations, hosted DB-role passwords, identity provisioning, traffic changes, and merges remain explicit owner gates.

---

### Task 1: Reconcile repository truth and replace ADR-0003

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
- Consumes: `docs/operations/2026-08-25-hosted-foundation.md`, O-012 through O-014, and the approved completion spec.
- Produces: the exact identity/session contract used by Tasks 2-7.

- [ ] **Step 1: Mark ADR-0003 Rejected with provider evidence**

Add:

```markdown
## Rejection evidence — 2026-08-29

Supabase documents `email` as a required access-token JWT claim that a Custom Access Token Hook cannot remove. The proposed synthetic email-like sign-in alias would therefore be embedded in the access JWT. Sending the standard Supabase SSR access-token cookie to the browser violates this ADR's requirement that the internal alias never enter browser storage.

The product will not weaken that acceptance criterion. ADR-0007 replaces this proposal with application-owned credentials and opaque sessions.
```

Reference the official Supabase Custom Access Token Hook and JWT documentation.

- [ ] **Step 2: Create ADR-0007 and set it Accepted**

ADR-0007 must lock these decisions:

```text
employee lookup: HMAC-SHA256 with EMPLOYEE_LOOKUP_PEPPER
credential storage: Argon2id in app_private.user_credentials
browser session: opaque application token only
pre-auth DB access: dedicated execute-only role/functions
post-auth DB access: separate runtime role + verified request account context + RLS
Supabase Auth user sessions: not used for product authentication
admin elevation: 15 minutes
step-up: 5 minutes, exact purpose, single use
passcode: 10-64 chars; generated temporary secret: 16 unambiguous chars
```

Record that this is the documented fallback already authorized by the approved completion design after Option A failed its security gate.

- [ ] **Step 3: Reconcile stale hosted-current-state claims**

README/PRODUCT/ARCHITECTURE/SECURITY/ROADMAP must agree on:

```text
https://guided-operations.vercel.app is the verified canonical foundation URL
private GitHub -> authoritative Vercel project linkage is verified
live foundation page and /api/health/live were remotely verified
O-012/O-013/O-014 are resolved
sign-in remains disabled until Milestone 1 passes
policy corpus remains unimported
operational/personnel data remains prohibited
```

Remove stale blockers claiming Vercel Git linkage/application inspection or OQ-005/OQ-006/OQ-007 remain unresolved.

- [ ] **Step 4: Replace auth.uid()-centric product-session text**

`docs/architecture/auth-rbac-rls.md` must describe this request path:

```text
opaque cookie -> pre-auth session lookup -> constant-time secret verification -> current account/status/auth_version verification -> APP_DATABASE_URL transaction -> SET LOCAL app.current_account_id -> DAL authorization -> RLS/grants
```

- [ ] **Step 5: Verify docs formatting**

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

### Task 2: Add forward-only opaque-auth schema, roles, functions, and pgTAP contracts

**Files:**
- Create: `supabase/migrations/20260829090000_opaque_authentication.sql`
- Modify: `supabase/tests/foundation.test.sql`
- Create: `supabase/tests/authentication.test.sql`
- Modify: `supabase/seed.sql`

**Interfaces:**
- Consumes: foundation `staff_members`, `user_accounts`, and `audit_events`.
- Produces: application account IDs, credential/session/rate-limit/step-up tables, `guided_operations_preauth`, `guided_operations_runtime`, two pre-auth lookup functions, and current-account RLS helpers.

- [ ] **Step 1: Add failing pgTAP checks first**

`authentication.test.sql` starts with catalog checks using the same style as `foundation.test.sql`:

```sql
begin;
select plan(24);
select has_column('app_private', 'user_accounts', 'id', 'user_accounts has application id');
select has_table('app_private', 'user_credentials', 'credential table exists');
select has_table('app_private', 'user_sessions', 'session table exists');
select has_table('app_private', 'auth_rate_limits', 'rate-limit table exists');
select has_table('app_private', 'admin_step_ups', 'step-up table exists');
select ok(exists(select 1 from pg_roles where rolname = 'guided_operations_preauth'), 'preauth role exists');
select ok(exists(select 1 from pg_roles where rolname = 'guided_operations_runtime'), 'runtime role exists');
select * from finish();
rollback;
```

The final 24 checks also prove every new table has both `relrowsecurity` and `relforcerowsecurity`, public/anon/authenticated/service_role have no direct auth-table grants, preauth has no table grants, only the reviewed preauth functions are executable by preauth, and token hashes are unique.

- [ ] **Step 2: Prove the new tests fail on the current schema**

```bash
npm run db:start
npm run db:reset
npm run db:test
```

Expected: `authentication.test.sql` fails because the new contract is absent.

- [ ] **Step 3: Start the migration with a zero-account/zero-audit safety assertion**

```sql
begin;

do $$
begin
  if exists (select 1 from app_private.user_accounts)
     or exists (select 1 from app_private.audit_events) then
    raise exception 'opaque auth migration requires the verified zero-account/no-operational-data foundation';
  end if;
end
$$;
```

- [ ] **Step 4: Refactor empty foundation identity columns forward-only**

```sql
alter table app_private.user_accounts add column id uuid not null default gen_random_uuid();
alter table app_private.user_accounts drop constraint user_accounts_pkey;
alter table app_private.user_accounts add primary key (id);
alter table app_private.user_accounts drop column auth_user_id;
alter table app_private.user_accounts drop column sign_in_alias;

alter table app_private.audit_events add column actor_account_id uuid
  references app_private.user_accounts(id) on delete set null;
drop index if exists app_private.audit_events_actor_occurred_idx;
alter table app_private.audit_events drop column actor_auth_user_id;
create index audit_events_actor_account_occurred_idx
  on app_private.audit_events (actor_account_id, occurred_at desc)
  where actor_account_id is not null;
```

Update `foundation.test.sql` so it proves the new account PK and audit actor FK rather than the superseded `auth.users` relationships.

- [ ] **Step 5: Add credentials and sessions**

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
  id uuid primary key,
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

Add indexes `(account_id, revoked_at)`, `idle_expires_at`, and `absolute_expires_at`.

- [ ] **Step 6: Add keyed rate-limit and admin step-up tables**

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
  id uuid primary key,
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

- [ ] **Step 7: Create two NOLOGIN group roles**

```sql
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'guided_operations_preauth') then
    create role guided_operations_preauth nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'guided_operations_runtime') then
    create role guided_operations_runtime nologin;
  end if;
end
$$;
```

Hosted LOGIN roles/passwords are provisioned later outside Git and granted membership in exactly one group role.

- [ ] **Step 8: Add pre-auth functions with empty search_path and minimal return shapes**

Create `api.resolve_login_context(p_employee_lookup_hash text)` and `api.resolve_session_context(p_session_id uuid)` as reviewed `security definer` exceptions. They return only the single-row fields needed for constant-time credential/session verification. Grant schema usage + execute to `guided_operations_preauth`; grant no table access to preauth.

- [ ] **Step 9: Add current-account helper and runtime RLS**

`app_private.current_account_id()` parses `current_setting('app.current_account_id', true)` and returns null on missing/invalid input. Enable+force RLS on all new tables. Runtime policies require `account_id = current_account_id()` for self credential/session rows; admin cross-account policies re-check authoritative `user_accounts.role/status`. Missing context returns no rows.

Grant runtime only the table operations actually used by Milestone 1; keep `anon`, `authenticated`, `service_role`, and `PUBLIC` at zero direct grants.

- [ ] **Step 10: Keep seed fictional and credential-free**

Do not persist reusable passcodes/session tokens in `seed.sql`. Create test credentials inside pgTAP/Vitest fixtures.

- [ ] **Step 11: Run the complete local database gate**

```bash
npm run db:reset
npm run db:lint
npm run db:test
```

Expected: migration replay, lint, foundation tests, and authentication tests all exit 0.

- [ ] **Step 12: Commit**

```bash
git add supabase/migrations/20260829090000_opaque_authentication.sql supabase/tests/foundation.test.sql supabase/tests/authentication.test.sql supabase/seed.sql
git commit -m "feat: add opaque authentication database contract"
```

---

### Task 3: Add server-only auth environment, hashing, token, CSRF, and database adapters

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `.env.example`
- Create: `src/lib/env/auth-server.ts`
- Create: `src/server/db/preauth.ts`
- Create: `src/server/db/runtime.ts`
- Create: `src/server/auth/employee-number.ts`
- Create: `src/server/auth/passcode.ts`
- Create: `src/server/auth/tokens.ts`
- Create: `src/server/auth/csrf.ts`
- Create: `src/server/auth/__tests__/employee-number.test.ts`
- Create: `src/server/auth/__tests__/passcode.test.ts`
- Create: `src/server/auth/__tests__/tokens.test.ts`

**Interfaces:**
- Produces: `normalizeEmployeeNumber`, `employeeLookupDigest`, `hashPasscode`, `verifyPasscode`, `validateNewPasscode`, `issueOpaqueToken`, `hashOpaqueSecret`, `deriveCsrfToken`, `createPreauthDb`, `createRuntimeDb`.

- [ ] **Step 1: Write failing primitive tests**

```ts
expect(normalizeEmployeeNumber("  ab-123  ")).toBe("AB-123");
expect(() => normalizeEmployeeNumber("\u0000bad")).toThrow();
expect(validateNewPasscode("AB-123", "AB-123").success).toBe(false);
expect(validateNewPasscode("AB-123", "aaaaaaaaaa").success).toBe(false);
expect(validateNewPasscode("AB-123", "CorrectHorse9").success).toBe(true);
expect(issueOpaqueToken().secret).toMatch(/^[A-Za-z0-9_-]{43}$/);
expect(hashOpaqueSecret("secret")).toMatch(/^[a-f0-9]{64}$/);
```

- [ ] **Step 2: Prove the tests fail**

```bash
npm test -- src/server/auth/__tests__
```

Expected: missing modules/functions.

- [ ] **Step 3: Add reviewed dependencies**

```bash
npm install @node-rs/argon2 postgres
```

Record locked versions and dependency-review output in the PR.

- [ ] **Step 4: Add exact server-only environment variables**

`.env.example` adds:

```dotenv
AUTH_LOOKUP_DATABASE_URL=
APP_DATABASE_URL=
SESSION_TOKEN_PEPPER=
AUTH_SUBJECT_PEPPER=
CSRF_TOKEN_PEPPER=
```

Keep `SUPABASE_DB_URL` migration/operator-only. `auth-server.ts` is `server-only` and Zod-validates non-empty URLs plus at least 32 bytes of encoded entropy for each pepper.

- [ ] **Step 5: Implement employee lookup hashing**

Use `createHmac("sha256", EMPLOYEE_LOOKUP_PEPPER)` over the normalized employee number. Do not expose a helper that returns raw employee number in diagnostic metadata.

- [ ] **Step 6: Implement Argon2id**

Use Argon2id with memory cost 64 MiB, time cost 3, parallelism 1, output length 32. Exact passcode bytes are case-sensitive and unnormalized.

- [ ] **Step 7: Implement opaque token and CSRF derivation**

`issueOpaqueToken()` returns UUID + 32 random bytes base64url. Store only `HMAC-SHA256(SESSION_TOKEN_PEPPER, secret)`. Derive CSRF as HMAC over `csrf:<session-id>:<secret>` using `CSRF_TOKEN_PEPPER`; compare using `timingSafeEqual`.

- [ ] **Step 8: Implement two PostgreSQL clients**

Both use:

```ts
postgres(url, { max: 1, prepare: false, idle_timeout: 20, connect_timeout: 10 })
```

`preauth.ts` may call only the two reviewed `api.resolve_*` functions plus rate-limit functions added by the migration. `runtime.ts` executes protected work inside a transaction that sets `SET LOCAL app.current_account_id = <verified account id>` before DAL queries.

- [ ] **Step 9: Run focused tests, typecheck, and lint**

```bash
npm test -- src/server/auth/__tests__
npm run typecheck
npm run lint
```

Expected: all exit 0.

- [ ] **Step 10: Commit**

```bash
git add package.json package-lock.json .env.example src/lib/env/auth-server.ts src/server/db src/server/auth
git commit -m "feat: add authentication security primitives"
```

---

### Task 4: Implement credential verification, abuse controls, opaque sessions, and revocation

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
- Produces: `authenticateEmployee`, `requireCurrentSession`, `rotateSessionIfNeeded`, `logoutSession`, `logoutAllSessions`, `changeOwnPasscode`.

- [ ] **Step 1: Write fake-repository service tests**

Cover unknown account, wrong passcode, locked, disabled, forced-change, success, idle expiry, absolute expiry, auth-version mismatch, previous-secret grace, rotation, logout, logout-all, and credential-change revocation.

All unknown/wrong/inactive public credential failures return:

```ts
{ ok: false, code: "invalid_credentials", message: "Unable to sign in with those credentials." }
```

- [ ] **Step 2: Prove focused tests fail**

```bash
npm test -- src/server/auth/__tests__/service.test.ts src/server/auth/__tests__/session.test.ts src/server/auth/__tests__/rate-limit.test.ts
```

- [ ] **Step 3: Implement constant-path login**

```text
normalize employee number
-> keyed lookup hash
-> evaluate account/device/network/global rate limits
-> load matching credential context OR use committed valid dummy Argon2 hash
-> Argon2 verify
-> re-check status/locked_until
-> record success/failure without raw identifiers
-> create opaque session
-> return minimal actor/session result
```

- [ ] **Step 4: Implement bounded abuse controls**

First account lock threshold: five failures inside 15 minutes. Lock duration grows exponentially from 30 seconds and caps at 15 minutes. Device/network/global buckets are independent so knowledge of one employee number cannot create a permanent account denial.

- [ ] **Step 5: Implement session validation and rotation**

A session is valid only when row exists, not revoked, idle+absolute expiry are future, account is active, `session.auth_version = account.auth_version`, and current secret hash matches or previous hash is within the 30-second grace. Rotate atomically when `rotated_at` is older than 30 minutes.

- [ ] **Step 6: Implement revocation rules**

Passcode change/reset, role/status change, disable, and logout-all increment `auth_version` and revoke all account sessions in one transaction.

- [ ] **Step 7: Run all auth unit tests**

```bash
npm test -- src/server/auth/__tests__
```

Expected: all pass.

- [ ] **Step 8: Commit**

```bash
git add src/server/auth
git commit -m "feat: implement opaque authentication lifecycle"
```

---

### Task 5: Add first-admin bootstrap, admin elevation/step-up, and minimal account lifecycle

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `scripts/bootstrap-admin.ts`
- Create: `src/server/auth/admin.ts`
- Create: `src/server/auth/__tests__/admin.test.ts`
- Create: `docs/operations/first-admin-bootstrap.md`

**Interfaces:**
- Produces: `bootstrapFirstAdmin`, `beginAdminElevation`, `issueAdminStepUp`, `consumeAdminStepUp`, `createOfficerAccount`, `resetAccountPasscode`, `setAccountStatus`, `setAccountRole`, `unlockAccount`.

- [ ] **Step 1: Write tests first**

Cover zero-account bootstrap success, second bootstrap rejection, generated temporary passcode + forced change, last-admin disable/demotion rejection, account creation, reset revocation, unlock, wrong/expired/replayed/wrong-purpose step-up.

- [ ] **Step 2: Prove admin tests fail**

```bash
npm test -- src/server/auth/__tests__/admin.test.ts
```

- [ ] **Step 3: Implement bootstrap under advisory lock**

Input is employee number + display name only. The service generates the 16-character temporary passcode internally, proves zero accounts under a transaction advisory lock, creates staff/account/credential rows, writes a redacted audit event, and returns the secret only to the authorized caller.

- [ ] **Step 4: Add operator-only bootstrap command**

```bash
npm install --save-dev tsx
```

Add:

```json
"auth:bootstrap-admin": "tsx scripts/bootstrap-admin.ts"
```

The script refuses `CI`, requires `process.stdout.isTTY`, and emits the temporary passcode exactly once to the interactive terminal. It never persists the secret.

- [ ] **Step 5: Implement elevation and step-up**

Elevation re-verifies the current admin passcode and lasts 15 minutes in server session state. High-impact action issues a random token bound to account/session/auth_version/purpose; DB stores only its hash; consumption is atomic and expires in 5 minutes.

- [ ] **Step 6: Implement account lifecycle services**

Create/reset generate temporary passcodes and force change. Disable, role change, reset, unlock, and logout-all require exact-purpose step-up and append allowlisted audit metadata only.

- [ ] **Step 7: Write the bootstrap runbook**

Document prerequisites, exact command, fictional-data boundary, TTY-only secret delivery, failure recovery, hosted activation gate, and proof that no credential is allowed in GitHub/Vercel logs.

- [ ] **Step 8: Run focused checks**

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

### Task 6: Enable sign-in, forced passcode change, logout, and protected Home

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
- Produces: first working authenticated Guided Operations screen.

- [ ] **Step 1: Read installed Next.js 16.3 docs before implementation**

Read version-matched docs for Server Actions, `cookies()`, `redirect()`, private/no-store rendering, and `proxy.ts` as required by `AGENTS.md`.

- [ ] **Step 2: Write component/action tests first**

Cover enabled form controls, generic failure, pending state, 429 guidance, forced-change redirect, invalid new passcode, successful dashboard redirect, logout, and no credential/session internals in action state.

- [ ] **Step 3: Prove auth UI tests fail**

```bash
npm test -- src/features/auth
```

- [ ] **Step 4: Implement sign-in Server Action**

Validate Zod input, call `authenticateEmployee`, set exact `go_session` cookie, redirect forced-change accounts to `/account/change-passcode`, otherwise `/home`. Return no employee existence signal or sensitive field.

- [ ] **Step 5: Replace the disabled foundation form**

Preserve the navy/gold foundation visual direction but remove disabled controls and inaccurate `being connected` copy only after the backend exists. Keep the private hobby/fictional-data boundary visible.

- [ ] **Step 6: Implement forced passcode change**

Require a valid session with `must_change_passcode`, render session-bound CSRF token, validate Origin/Sec-Fetch-Site + CSRF, change Argon2 hash, increment auth_version, revoke old sessions, issue one replacement session, redirect `/home`.

- [ ] **Step 7: Implement protected `/home` Server Component**

`requireCurrentSession()` returns only safe actor DTO fields. Render display name, role, and trusted session state. Do not invent incidents, forms, activity, or policy data.

- [ ] **Step 8: Add lightweight `proxy.ts`**

Proxy checks only syntactic presence of `go_session` to avoid obvious unauthenticated protected-route rendering. Database-backed `requireCurrentSession()` remains authoritative.

- [ ] **Step 9: Add logout Server Action**

POST/Server Action with Origin+CSRF validation, DB revocation, cookie clear, redirect `/`.

- [ ] **Step 10: Run UI + build gates**

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

### Task 7: Prove Milestone 1 end to end and record evidence

**Files:**
- Create: `tests/e2e/authentication.spec.ts`
- Modify: `playwright.config.ts`
- Modify: `supabase/tests/authentication.test.sql`
- Modify: `docs/quality/testing.md`
- Modify: `ROADMAP.md`
- Modify: `docs/operations/2026-08-25-hosted-foundation.md`

**Interfaces:**
- Produces: local Milestone 1 evidence. Hosted activation remains a separate owner gate.

- [ ] **Step 1: Extend Playwright to mobile + desktop auth coverage**

Keep existing Chromium and add a mobile Chromium project using `devices["iPhone 13"]`. `authentication.spec.ts` covers:

```text
unknown + wrong passcode -> identical generic error
known + wrong passcode -> identical generic error
rate limit -> generic retry response
first fictional admin -> forced change -> home
admin lifecycle creates fictional officer -> forced change -> home
disabled existing session -> denied
logout -> cookie cleared -> protected route redirected
logout-all -> second browser context denied
role/status auth_version change -> stale session denied
missing/wrong CSRF -> rejected
cross-site Origin -> rejected
keyboard-only sign-in/change/logout
390x844 + desktop no overflow, console error, or failed asset
```

- [ ] **Step 2: Expand pgTAP direct-bypass checks**

Prove public/anon/authenticated/service_role and preauth cannot select credential/session hashes directly; missing runtime context gets zero protected rows; officer context cannot access another account; active admin context follows only the explicit admin policies.

- [ ] **Step 3: Run full local database gate**

```bash
npm run db:reset
npm run db:lint
npm run db:test
```

Expected: all exit 0.

- [ ] **Step 4: Run full web/browser gate**

```bash
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
```

Expected: all exit 0.

- [ ] **Step 5: Update docs with only proven local evidence**

Keep hosted migration, hosted role credentials, Vercel secrets, hosted fictional identities, and hosted browser verification explicitly open.

- [ ] **Step 6: Update GitHub Issue #2**

Post commit SHA, exact green local/CI gates, remaining external owner gates, and next blocker. Do not close the master goal.

- [ ] **Step 7: Commit**

```bash
git add tests/e2e/authentication.spec.ts playwright.config.ts supabase/tests/authentication.test.sql docs/quality/testing.md ROADMAP.md docs/operations/2026-08-25-hosted-foundation.md
git commit -m "test: qualify milestone 1 authentication"
```

---

## Hosted activation gate after Tasks 1-7

Do not perform automatically. Explicit owner authorization is required for each hosted-security/data change:

1. Apply the reviewed forward migration to the designated non-production Supabase project.
2. Provision one LOGIN role for `guided_operations_preauth` membership and one separate LOGIN role for `guided_operations_runtime` membership; passwords are generated out of band and never committed.
3. Configure `AUTH_LOOKUP_DATABASE_URL` and `APP_DATABASE_URL` in Vercel Preview only.
4. Generate/configure `SESSION_TOKEN_PEPPER`, `AUTH_SUBJECT_PEPPER`, and `CSRF_TOKEN_PEPPER` in Vercel's secret store.
5. Run first-admin bootstrap with a fictional administrator only.
6. Create one fictional officer through the protected lifecycle path.
7. Verify the exact reviewed commit in a protected Vercel Preview on desktop/mobile.
8. Re-run login, forced change, disable, logout-all, rotation, rate-limit, CSRF, and cross-origin cases against Preview.
9. Record hosted evidence in ADR-0007, ROADMAP, hosted-foundation evidence, and Issue #2.

## Plan Self-Review

- **Spec coverage:** status reconciliation, failed Option A handling, credential/session implementation, two-role DB boundary, RLS/grants, first-admin bootstrap, fictional officer lifecycle, protected dashboard, and browser/security evidence are all mapped to tasks.
- **Placeholder scan:** no TBD/TODO or unknown path remains; Playwright uses the repository's actual `tests/e2e` directory.
- **Foundation consistency:** `foundation.test.sql` is explicitly updated because the forward migration removes the now-superseded `auth.users` foreign keys.
- **Data model consistency:** audit actor identity is migrated from `actor_auth_user_id` to `actor_account_id`; product sessions do not depend on Supabase Auth user IDs.
- **Least privilege:** pre-auth and post-auth database credentials are separate; pre-auth has execute-only function access and no table grants.
- **Scope:** incident/report, forms, RAG, and full administrator command-center work remain later roadmap milestones.
- **External blocker:** PR #3's GitHub Actions job currently fails before runner assignment (`runner_id: 0`, no steps). This plan does not treat that as a passing gate and does not authorize bypassing it.
