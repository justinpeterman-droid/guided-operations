# Adversarial security review — Milestone 1 opaque authentication

- **Date:** 2026-08-30
- **Evidence label:** MANUAL (agent-assisted review; not an approved penetration test)
- **Scope:** `feat/milestone-1-opaque-auth` ([PR #4](https://github.com/justinpeterman-droid/guided-operations/pull/4))
- **Assumption:** Authentication will eventually protect sensitive correctional workflows.
- **Source-of-truth:** ADR-0007, `SECURITY.md`, `docs/architecture/auth-rbac-rls.md`
- **Status:** Open findings — implementation not approved for real operational data

This record captures adversarial review findings for Claude and human reviewers.
It does not authorize production use, deployment, or account provisioning.

## Review method

Static analysis of application code, SQL migrations, pgTAP tests, and ADR
acceptance criteria. Categories exercised:

- authentication bypass
- employee enumeration
- session fixation
- CSRF
- token theft
- timing leakage
- privilege escalation
- stale authorization
- RLS bypass
- bootstrap/reset weaknesses
- lockout abuse
- logging leakage
- Supabase trust-boundary mistakes

## Positive controls (not findings)

- Server-issued opaque session IDs; login overwrites any prior `go_session` cookie (session fixation mitigated).
- Pre-auth/runtime Postgres roles use `noinherit`; transactions set `SET LOCAL ROLE`.
- Unknown-account login path verifies scrypt against a committed dummy hash.
- Session secrets stored as HMAC-SHA256 digests only; raw secret stays in HttpOnly cookie.
- Generic login failure text; rate limits on account, device, network, and global dimensions.
- `auth_version` bump and session revocation on passcode change (DB transaction).
- Supabase Data API roles revoked from `app_private`; auth tables RLS enabled and forced.

---

## Findings summary

| ID | Severity | Title |
|----|----------|-------|
| C-1 | Critical | Compromised `APP_DATABASE_URL` enables session minting without passcode proof |
| C-2 | Critical | Administrator step-up not implemented; admin authority equals session cookie |
| H-1 | High | Passcode change without re-authentication enables account takeover from stolen session |
| H-2 | High | Device/network binding stored at login but never enforced on session use |
| H-3 | High | Lockout timer resets on every failure while account is already locked |
| H-4 | High | Authorization gates are page-local, not a centralized enforcement boundary |
| H-5 | High | Session secret rotation disabled in all production callers |
| M-1 | Medium | Employee enumeration via login timing side channels |
| M-2 | Medium | Passcode change skips substring employee-number check |
| M-3 | Medium | Authenticated responses lack `Cache-Control: private, no-store` |
| M-4 | Medium | Global auth DoS via shared rate-limit bucket |
| M-5 | Medium | scrypt on every attempt enables CPU exhaustion |
| M-6 | Medium | Supabase browser client remains a future trust-boundary trap |
| M-7 | Medium | Security-definer pre-auth surface lacks caller attestation |
| M-8 | Medium | Bootstrap / reset / unlock ceremonies absent |
| M-9 | Medium | Auth-table RLS is deny-by-revoke only; negative SELECT tests missing |
| L-1 | Low | Logout CSRF failure leaves session active with no user feedback |
| L-2 | Low | Shared `unknown-network` rate-limit bucket |
| L-3 | Low | Invalid vs valid employee-number format uses different digest paths |
| L-4 | Low | Documentation / schema drift (scrypt vs Argon2id) |
| L-5 | Low | No login/logout audit events |

---

## Critical

### C-1 — Compromised `APP_DATABASE_URL` = full authentication bypass

**Evidence:** `app_private.preauth_create_session` inserts a session after checking
hash format, expiry bounds, and account state — not credential proof.

```sql
-- supabase/migrations/20260829110000_authentication_services.sql
insert into app_private.user_sessions (
  id, account_id, secret_hash, auth_version, device_hash, network_hash,
  idle_expires_at, absolute_expires_at
) values (...);
```

The application DB login role (`guided_operations_app`) inherits both
`guided_operations_preauth` and `guided_operations_runtime`. Anyone with
`APP_DATABASE_URL` can call `preauth_lookup_account` and
`preauth_create_session` directly.

**Attack:** Secret leak → arbitrary session creation → full account access.

**Recommended fix:**

- Treat `APP_DATABASE_URL` as tier-0; rotation runbook and access auditing.
- Split DB users: pre-auth cannot execute runtime mutations; runtime cannot execute session-mint functions.
- Network-restrict DB access (Supabase IP allowlist / private link).
- Optional: bind session creation to a server nonce issued only after passcode verify.

---

### C-2 — Administrator step-up not implemented

**Evidence:** `admin_step_ups` table and `admin_elevated_until` column exist.
Application code loads `adminElevatedUntil` but never checks it. No step-up
issuance, verification, or purpose binding in `src/`. ADR-0007 requires
≤15-minute elevation and 5-minute single-use step-up for high-impact actions.

**Attack:** When admin routes ship, a stolen session cookie grants destructive
capability with no second factor or purpose binding.

**Recommended fix:** Block admin mutations until step-up exists. Implement
purpose-scoped single-use tokens, short TTL, `auth_version` coupling, and
pgTAP + integration tests for replay, wrong-purpose, and expired cases.

---

## High

### H-1 — Passcode change without re-authentication

**Evidence:** `changePasscodeAction` requires session + CSRF only — no current
passcode (`src/app/actions/auth.ts`). DB revokes all sessions and bumps
`auth_version` (`runtime_change_passcode`).

**Attack:** Stolen `go_session` cookie → attacker sets known passcode → victim
locked out → attacker logs in with new passcode.

**Recommended fix:** Require current passcode or fresh step-up. Rate-limit
passcode change separately. Consider issuing one replacement session after
verified change.

---

### H-2 — Device/network binding not enforced on session use

**Evidence:** `device_hash` and `network_hash` written at login
(`src/server/auth/service.ts`). `preauth_refresh_session` validates secret hash,
expiry, revocation, and `auth_version` — not device or network
(`supabase/migrations/20260829110000_authentication_services.sql`).

**Attack:** Stolen cookie works from any device/IP until expiry or revocation.

**Recommended fix:** Compare device cookie hash and network hash on refresh;
on mismatch require re-login or step-up. Alert on change for admin sessions.

---

### H-3 — Lockout timer resets while account already locked

**Evidence:** `preauth_record_login_failure` sets
`locked_until = now + lock_seconds` whenever `failed_attempts + 1 >= lock_after`,
including when the account is already locked.

**Attack:** Attacker sends one wrong password every ~14 minutes → victim lock
window never expires → indefinite denial of login.

**Recommended fix:** Extend `locked_until` only on transition into `locked`, not
on every subsequent failure. Cap total lock duration. Admin unlock with audit.

---

### H-4 — Authorization gates are page-local

**Evidence:** `must_change_passcode` enforced via redirects in
`src/app/page.tsx` and `src/app/change-passcode/page.tsx` only. No middleware.
`getCurrentSession` does not reject sessions that have not completed forced
passcode change.

**Attack:** New routes/actions that call `getCurrentSession()` but skip redirect
checks allow pre-change access with a valid session.

**Recommended fix:** Central session gate (`requireSession({ allowMustChange? })`)
on all protected routes and Server Actions. Deny-by-default. Test matrix:
pending, disabled, locked, must-change, expired temp passcode, post-`auth_version` bump.

---

### H-5 — Session secret rotation disabled in all callers

**Evidence:** Rotation logic in `src/server/auth/service.ts` (30-minute threshold,
30-second grace). Every caller passes `rotate: false`
(`src/server/auth/current-session.ts`, `src/app/actions/auth.ts`). ADR-0007
requires rotation after 30 minutes.

**Attack:** Stolen cookie valid up to 12 hours with static secret.

**Recommended fix:** Enable rotation on session touch; write
`replacementSessionToken` via `setSessionCookie`. Test concurrent requests during
grace window.

---

## Medium

### M-1 — Login timing side channels (employee enumeration)

**Evidence:** Known active account + wrong passcode: scrypt verify **and**
`recordLoginFailure` (DB write). Unknown/disabled/pending/locked: scrypt on dummy
hash **without** failure recording (`src/server/auth/service.ts` lines 176–190).
Lookup JOIN latency may also differ.

**Attack:** Remote timing distinguishes valid employee numbers despite generic errors.

**Recommended fix:** Fixed-work login path (always same DB ops). Timing regression
tests. CAPTCHA or proof-of-work after threshold.

---

### M-2 — Passcode change skips substring employee-number check

**Evidence:** `validateNewPasscode` checks substring inclusion; change flow uses
`validatePasscodeShape` + `passcodeEqualsEmployeeLookupHash` only
(`src/server/auth/service.ts` `changePasscode`).

**Attack:** Passcode embedding employee number (e.g. `AGENCY-1001-SUFFIX`) may pass.

**Recommended fix:** Call `validateNewPasscode` with authoritative employee context in change flow.

---

### M-3 — Authenticated responses lack cache hardening

**Evidence:** ADR-0007 and `docs/architecture/api-contracts.md` require
`private, no-store` for authenticated content. Pages set `dynamic = "force-dynamic"`
but no `Cache-Control` headers. Only `/api/health/live` sets `no-store`.

**Attack:** Shared terminal or proxy caches HTML with display name, hint, CSRF token.

**Recommended fix:** Set `Cache-Control: private, no-store` on authenticated layouts/routes.

---

### M-4 — Global auth DoS

**Evidence:** Global limit 1000 attempts / 60 seconds (`src/server/auth/service.ts`).
Attacker exhausts bucket → all users get `rate-limited` before lookup.

**Recommended fix:** Edge rate limiting, WAF rules, monitor global saturation, captcha tier.

---

### M-5 — scrypt CPU exhaustion

**Evidence:** Every login runs scrypt (`N=32768`) even under abuse. Up to 1000/min globally.

**Recommended fix:** Edge throttling before origin; lower global ceiling; proof-of-work after N failures.

---

### M-6 — Supabase browser client trust-boundary trap

**Evidence:** `src/lib/supabase/browser.ts` exposes publishable-key client. Auth
correctly bypasses Supabase Auth, but factory invites direct PostgREST from Client
Components. Product tables have RLS enabled with no policies yet.

**Recommended fix:** Gate or remove browser client until ADR-approved exposed surface.
Lint ban on `@supabase/*` outside server adapters.

---

### M-7 — Security-definer pre-auth surface without caller attestation

**Evidence:** Seven `SECURITY DEFINER` functions for `guided_operations_preauth`;
safety depends entirely on grant hygiene and `SET LOCAL ROLE` in every transaction.

**Recommended fix:** pgTAP negative tests per role; CI failure on new grants to auth tables.

---

### M-8 — Bootstrap / reset / unlock absent

**Evidence:** ADR-0007 bootstrap ceremony (advisory lock, generated temp passcode,
zero-account gate, TTY-only delivery) not implemented in `src/`.

**Attack:** Manual SQL provisioning bypasses audit, throttling, temp expiry, forced change.

**Recommended fix:** Implement reviewed bootstrap CLI before any real accounts.

---

### M-9 — Auth-table RLS not policy-tested

**Evidence:** `user_credentials`, `user_sessions`, `auth_rate_limits`, `admin_step_ups`
have RLS enabled+forced, zero policies, zero table grants. pgTAP verifies grant
counts but not `SELECT` denial as each role.

**Recommended fix:** Explicit deny policies + negative SELECT tests in pgTAP.

---

## Low

### L-1 — Logout CSRF failure silent

**Evidence:** `logoutAction` returns without clearing cookie when CSRF fails
(`src/app/actions/auth.ts`).

**Recommended fix:** Clear cookie and redirect on any logout intent.

---

### L-2 — Shared `unknown-network` bucket

**Evidence:** `networkIdentifierFromHeaders` returns `"unknown-network"` when
platform headers absent (`src/server/auth/http.ts`).

**Recommended fix:** Fail closed in production if Vercel forwarding header missing; alert on ratio.

---

### L-3 — Employee-number format timing oracle

**Evidence:** `prepareEmployeeLookupHash` uses different paths for valid vs invalid format
(`src/server/auth/service.ts`).

**Recommended fix:** Single constant-work digest path.

---

### L-4 — scrypt vs Argon2id documentation drift

**Evidence:** Migration comment on `user_credentials` says Argon2id; ADR-0007 and
implementation use scrypt. Milestone plan still references Argon2id.

**Recommended fix:** Align migration comments, SECURITY.md, and plan docs with ADR-0007.

---

### L-5 — No login/logout audit events

**Evidence:** Audit inserts on passcode change and revoke-all only. No login success/failure audit.

**Recommended fix:** Allowlisted metadata only (opaque IDs, outcome, reason codes).

---

## Category matrix

| Category | Finding IDs |
|----------|-------------|
| Authentication bypass | C-1, C-2, H-4 |
| Employee enumeration | M-1, L-3 |
| Session fixation | Mitigated (not a finding) |
| CSRF | H-1 (with M-3), L-1 |
| Token theft | H-2, H-5, M-3 |
| Timing leakage | M-1, L-3 |
| Privilege escalation | C-2, H-1, H-4 |
| Stale authorization | H-4, H-5 |
| RLS bypass | C-1, M-6, M-7, M-9 |
| Bootstrap/reset | M-8 |
| Lockout abuse | H-3, M-4 |
| Logging leakage | L-5 |
| Supabase trust boundary | M-6, C-1 |

---

## Remediation priority

1. C-1 — DB credential separation and network controls
2. H-3 — Lock timer extension bug
3. H-1 — Re-auth on passcode change
4. H-4 — Central session gate before new routes
5. C-2, M-8 — Step-up and bootstrap before admin/provisioning
6. H-2, H-5 — Device binding and rotation wiring
7. M-1, M-3 — Timing hardening and cache headers
8. M-6, M-9 — Supabase client guardrails and negative RLS tests

---

## Disposition tracking

| ID | Owner decision | Target milestone | Resolved in commit |
|----|----------------|------------------|-------------------|
| C-1 | | | |
| C-2 | | | |
| H-1 | | | |
| H-2 | | | |
| H-3 | | | |
| H-4 | | | |
| H-5 | | | |
| M-1 | | | |
| M-2 | | | |
| M-3 | | | |
| M-4 | | | |
| M-5 | | | |
| M-6 | | | |
| M-7 | | | |
| M-8 | | | |
| M-9 | | | |
| L-1 | | | |
| L-2 | | | |
| L-3 | | | |
| L-4 | | | |
| L-5 | | | |

Update this table when findings are accepted, deferred, or closed.
