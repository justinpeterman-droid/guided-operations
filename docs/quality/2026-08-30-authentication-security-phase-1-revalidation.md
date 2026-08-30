# Authentication security — Phase 1 current-main revalidation

- **Date:** 2026-08-30
- **Target:** `main` at/after 005/409 mapping merge
  `7ca6711fdc375aaac0a14e548f854c6a3dabe021`
- **Method:** static current-main reproduction review against the historical PR
  #4 hypotheses
- **Boundary:** no production fixes in this phase; hosted-only claims remain
  unproven until hosted tests run

## Executive result

The historical PR #4 report does **not** reproduce its two Critical claims
against current `main`. The current implementation has materially changed.
Several former findings are directly closed by code evidence, while timing,
hosted abuse, complete RLS/grant coverage, and provider lifecycle behavior still
require dynamic/hosted qualification.

## Revalidation results

| Hypothesis                                              | Result                                       | Current-main evidence                                                                                                                                                                                                                                                                                                                                     |
| ------------------------------------------------------- | -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C-1 arbitrary session minting through app DB credential | **NOT REPRODUCED / architecture superseded** | Current pre-auth path performs only a private active alias lookup, then requires Supabase password authentication. Current session authority comes from provider claims plus authoritative account/auth-version checking. Direct DB credential/network restriction remains an operational hardening gate.                                                 |
| C-2 admin authority equals stolen session               | **NOT REPRODUCED**                           | Purpose-bound 5-minute step-up tokens exist. Consumption binds account, session, auth_version, purpose, request ID and keyed token digest; the store is expected to consume once. Purpose-specific admin routes exist. Dynamic replay/wrong-purpose/expiry tests remain part of release qualification.                                                    |
| H-1 stolen session can change personal passcode         | **CLOSED BY CURRENT CODE**                   | `changePersonalPasscode` requires `currentPasscode`, verifies it against the provider identity, verifies employee identity digest, validates the new passcode against the employee number, then updates password and performs provider-wide sign-out before sealing success.                                                                              |
| H-2 device/network session binding absent               | **SUPERSEDED / design decision**             | Device/network identifiers are current pre-auth abuse-control dimensions, not opaque-session binding fields. Current sessions are encrypted provider sessions. Session-theft resistance now depends on HttpOnly encrypted cookies, provider refresh/revocation, auth_version checks and administrator assurance. Hosted lifecycle proof remains required. |
| H-3 attacker indefinitely extends account lock          | **NOT REPRODUCED IN CURRENT APP LAYER**      | Current application uses bounded sliding/fixed attempt windows across account/device/network/global subjects rather than the PR #4 `locked_until = now + ...` mutation. Provider-side lockout behavior still needs hosted abuse qualification.                                                                                                            |
| H-4 page-local authorization / forced-change bypass     | **NOT REPRODUCED IN CORE GATE**              | `authorizeCurrentSession` verifies provider claims and authoritative account state; `checkCurrentAccount` denies auth-version mismatch, non-active status, forced passcode change by default, and insufficient role. Remaining work is route/action coverage verification rather than a missing central primitive.                                        |
| H-5 session secret rotation disabled                    | **SUPERSEDED**                               | PR #4 custom opaque-session secret rotation is no longer the session architecture. Current proxy refreshes Supabase Auth through encrypted server-managed storage. Hosted refresh/revocation browser proof remains required.                                                                                                                              |
| M-1 employee enumeration timing                         | **OPEN — DYNAMIC TEST REQUIRED**             | Known and unknown employee numbers both perform a provider password-auth call; unknown uses a maintained dummy alias. Database lookup and provider paths may still have measurable distributions. Requires repeated hosted timing samples; static review cannot close it.                                                                                 |
| M-2 passcode change omits employee-number rule          | **CLOSED BY CURRENT CODE**                   | Personal passcode change calls `validatePasscode(newPasscode, normalizedEmployeeNumber)` and also verifies authoritative employee identity digest.                                                                                                                                                                                                        |
| M-3 authenticated responses cacheable                   | **CLOSED FOR GLOBAL PROXY + sampled APIs**   | Session proxy sets `Cache-Control: private, no-store, max-age=0`, `Pragma: no-cache`, and `Expires: 0`; sampled auth/API routes also use private/no-store. Browser/header qualification should verify all protected surfaces.                                                                                                                             |
| M-4 global auth DoS                                     | **OPEN — HOSTED ABUSE TEST**                 | A global opaque attempt subject intentionally exists. Policy behavior is bounded, but distributed abuse and edge/origin saturation require hosted testing/monitoring evidence.                                                                                                                                                                            |
| M-5 scrypt CPU exhaustion                               | **SUPERSEDED / OPEN AS GENERAL ABUSE COST**  | Current application delegates password verification to Supabase Auth; it no longer runs the PR #4 scrypt verifier on every request. Provider/origin cost under abuse remains a hosted concern.                                                                                                                                                            |
| M-6 browser Supabase client trust trap                  | **NOT REPRODUCED BY SEARCH**                 | No current `createBrowserClient`/browser Supabase client was found in the current-main search. Continue enforcing server-only DAL boundaries and CI/static guardrails.                                                                                                                                                                                    |
| M-7 security-definer pre-auth caller attestation        | **SUPERSEDED / DB GRANT TEST REQUIRED**      | Current private pre-auth implementation is a server-only direct SQL alias lookup, not the seven PR #4 session-mint functions. Dedicated credential grants and direct negative access still require database qualification.                                                                                                                                |
| M-8 bootstrap/reset/unlock absent                       | **NOT REPRODUCED**                           | First-admin bootstrap implementation exists with generated temporary passcode, random internal alias, staging/activation, delivery-before-activation and cleanup. Purpose-bound admin unlock/reset UI/routes also exist. Hosted operator rehearsal remains required.                                                                                      |
| M-9 auth-table RLS negative tests missing               | **OPEN QUALIFICATION GATE**                  | Current architecture requires direct anon/authenticated/dedicated-role negative tests. Static review here does not prove the full database matrix.                                                                                                                                                                                                        |
| L-1 logout CSRF failure silently leaves session         | **PARTIALLY REPRODUCED / policy choice**     | Current logout returns explicit 403 `request_not_allowed` and emits an operational event when CSRF/origin validation fails; it does not clear provider authority on an untrusted request. This is safer than allowing cross-site logout, but UX should surface failure clearly. Not classified as an auth bypass.                                         |
| L-2 shared unknown-network bucket                       | **REPRODUCED AS INTENTIONAL DEGRADATION**    | Missing `x-vercel-forwarded-for` maps to one `unavailable` network subject while device/global controls remain. Production monitoring should alert on unexpected missing forwarding headers.                                                                                                                                                              |
| L-3 employee-number format timing oracle                | **OPEN — DYNAMIC TEST REQUIRED**             | Normalization/digest work is cheap and common, but alias lookup/provider behavior needs hosted distribution testing for malformed vs valid-looking identifiers.                                                                                                                                                                                           |
| L-4 scrypt/Argon2id documentation drift                 | **NOT REPRODUCED BY CURRENT SEARCH**         | Current repository search did not return active Argon2id/scrypt implementation claims; accepted docs describe provider-backed alias bridge. Continue documentation drift checks.                                                                                                                                                                          |
| L-5 no login/logout audit events                        | **CLOSED BY CURRENT CODE**                   | Sign-in emits `auth.sign_in` safe operational events with bounded outcome/status/duration/request ID; sign-out emits `auth.sign_out` events. No employee number, passcode, alias, token or narrative is included by these route event calls.                                                                                                              |

## Remaining Phase 1 security gates

### Hosted/dynamic

- Timing distributions: known wrong secret vs unknown vs malformed employee
  number.
- Global/device/network abuse behavior and edge/origin saturation.
- Supabase Auth refresh, revocation, logout-all, passcode replacement, and
  disabled/role-change behavior in real browsers.
- Missing forwarding-header alerting and behavior in Production/Preview.

### Database

- Explicit negative SELECT/INSERT/UPDATE/DELETE/RPC matrix for anon,
  authenticated, pre-auth/dedicated roles, and admin/service-only adapters.
- Confirm the credential used by the private alias lookup has only the minimum
  required schema/table/function access.
- Confirm no browser/Data API path exposes `app_private` identities or aliases.

### Route coverage

- Enumerate every protected page/API/Server Action and prove it reaches the
  authoritative current-account gate or an equivalent stricter authorization
  boundary.
- Exercise forced-passcode-change, pending/locked/disabled, stale auth_version,
  demoted admin, wrong-purpose/expired/replayed step-up, and concealed-resource
  cases.

## Phase 1 disposition

No Critical current-main vulnerability was reproduced from the historical PR #4
report during this static revalidation. H-1, M-2, L-5 and the core C-2 concern
are closed by direct current-code evidence. Several architecture-specific
findings are superseded. The remaining meaningful risks are qualification gaps:
hosted timing/abuse/provider lifecycle, exhaustive route authorization coverage,
and the database grant/RLS negative matrix.

This result does **not** authorize production use. The remaining
dynamic/database gates must be executed against the exact release candidate
before security acceptance.
