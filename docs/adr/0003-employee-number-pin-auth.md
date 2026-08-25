# ADR-0003: Employee Number Plus PIN-Like Authentication

- **Status:** Proposed
- **Date:** 2026-08-25
- **Deciders:** Product owner, security owner, and technical lead

## Context

Users need the familiar employee-number plus PIN-like sign-in experience. The
system must use individual accounts and cannot use the former shared
access/admin codes. Hosted Supabase password Auth accepts email or phone
identifiers, not an arbitrary employee-number username. A final implementation
decision is required before production code can claim this requirement is
complete.

The initial release stores no real operational records, but authentication
metadata still deserves production-grade protection.

## Proposed decision

Prefer a server-only Auth alias bridge, subject to a hosted Supabase spike and
security approval:

- Normalize employee number and resolve it by a keyed lookup digest in the
  non-exposed `app_private` schema.
- Map the account to a random, non-user-facing Auth alias.
- Call Supabase Auth password sign-in on the server using that alias.
- Use the supported SSR access/refresh cookie flow.
- Keep application role, status, forced-change state, and auth_version in
  `app_private.user_accounts` and recheck them server-side.
- Disable public signup and generic email/phone recovery.
- Use a password-class PIN-like secret with a proposed minimum of eight
  characters; reject employee-number equality/common sequences.
- Apply account/device/network/global limits and generic errors.
- Use protected Auth admin operations for account creation/reset only after
  active-admin, CSRF, idempotency, and purpose-bound step-up checks.

This is not Accepted until every action item passes. If the alias lifecycle
cannot be made safe, choose Option B rather than reducing credential strength or
exposing aliases.

## Options considered

### Option A: Supabase Auth with private server-only alias bridge

| Dimension            | Assessment                                   |
| -------------------- | -------------------------------------------- |
| User experience      | Meets employee number + PIN-like requirement |
| Supabase integration | Strong after adapter                         |
| Security complexity  | Medium-high                                  |
| Custom cryptography  | Low                                          |
| Status               | Preferred, requires spike                    |

Pros:

- Supabase owns password hashing and session rotation.
- Works with Auth JWT identity and RLS.
- Browser never learns the synthetic alias.
- Preserves the practical login UI.

Cons:

- Relies on a non-user-facing email-like alias behavior that must be validated.
- Auth admin API secret is powerful and must be isolated.
- Generic recovery/email flows do not naturally fit.
- JWT revocation is not instantaneous without current account checks/short TTL.

### Option B: Custom employee credential and opaque session tables

| Dimension                          | Assessment                               |
| ---------------------------------- | ---------------------------------------- |
| User experience                    | Exact fit                                |
| Supabase integration               | PostgreSQL only; Auth not used for users |
| Security complexity                | High                                     |
| Custom cryptography/session burden | High                                     |
| Status                             | Fallback if Option A fails               |

Pros:

- Exact employee-number semantics and lifecycle.
- Immediate auth_version/session-family revocation can mirror old behavior.
- No synthetic email/phone alias.

Cons:

- The project owns Argon2id parameters, token generation/hashing, rotation,
  refresh reuse detection, cookies, and future MFA integration.
- More security-critical code and testing.
- Loses direct Supabase Auth/RLS identity integration unless custom JWT/session
  bridging is added.

### Option C: Email/phone password, SSO, or passkey identity

| Dimension          | Assessment                          |
| ------------------ | ----------------------------------- |
| User experience    | Does not meet current requirement   |
| Security potential | Strong, especially SSO/passkeys/MFA |
| Implementation     | Provider-supported                  |
| Status             | Future reconsideration              |

Pros:

- Native provider flows and recovery.
- Better long-term MFA/identity assurance options.

Cons:

- Requires users to supply a different identifier.
- Adds email/phone/identity-provider dependencies not currently requested.

### Option D: Shared facility code or four-digit common PIN

Rejected. It removes attribution, makes revocation/audit ineffective, and is
explicitly prohibited.

## Trade-off analysis

Option A keeps password storage and sessions in a reviewed Auth system while
preserving the UI. Its safety depends on proving the alias and recovery
lifecycle, not just making sign-in succeed. Option B is acceptable only with a
dedicated threat model and comprehensive parity tests. A short shared/numeric
credential is not an acceptable simplification.

## Security acceptance criteria

- At least eight-character approved secret policy; final alphabet/length signed
  off after usability testing.
- Internal alias never appears in UI, API, logs, analytics, audit details,
  browser storage, emails, or recoverable public endpoints.
- Unknown and known employee numbers have generic responses and bounded timing.
- Public signup/recovery is unavailable.
- System-generated temporary secret expires and forces change.
- Login/account/device/network/global rate limits and bounded lockout work.
- Secure HttpOnly SameSite cookies, refresh rotation, expiry, logout,
  logout-all, reset, deactivation, and role change pass real-browser tests.
- Current account role/status/auth_version is checked on sensitive requests.
- Auth admin secret is server-only and isolated from routine DAL clients.
- Purpose-bound single-use admin step-up and last-admin protection pass tests.
- Complete grants/RLS matrix passes direct bypass attempts.
- First-admin bootstrap and secret delivery have an approved runbook.

## Consequences if accepted

- Employee number is a lookup input, not the Auth provider identifier exposed to
  the user.
- Account provisioning/reset requires a tightly controlled Auth admin adapter.
- Email-based recovery/verification is not part of the experience.
- Admin MFA remains a follow-up decision and is preferred before real
  operational data.
- Credential and Auth behavior are versioned product contracts with security
  regression tests.

## Action items

1. [ ] Decide final secret length, alphabet, normalization, and admin MFA
       requirement.
2. [ ] Spike random internal aliases on a disposable hosted Supabase project.
3. [ ] Prove no email/recovery/alias exposure and document account lifecycle.
4. [ ] Implement SSR cookies and session revocation tests in a vertical slice.
5. [ ] Threat-model enumeration, lockout denial, Auth admin secret, and
       bootstrap.
6. [ ] Obtain product/security acceptance or record Option B as a new ADR.
