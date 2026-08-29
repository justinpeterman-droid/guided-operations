# ADR-0003: Employee Number Plus PIN-Like Authentication

- **Status:** Rejected
- **Date:** 2026-08-25
- **Rejected:** 2026-08-29
- **Deciders:** Product owner, security owner, and technical lead
- **Replacement:** ADR-0007

## Context

Users need employee-number plus personal-passcode sign-in with individual accounts. The former shared access/admin codes are prohibited. Supabase password Auth accepts email or phone identifiers rather than an arbitrary employee-number username, so this ADR proposed a random server-only synthetic Auth alias.

The proposal was acceptable only if the alias never appeared in user-facing surfaces, APIs, logs, analytics, audit details, browser storage, emails, redirects, or recoverable public endpoints.

## Rejected proposal

The preferred Option A was:

1. normalize employee number and resolve it by a keyed lookup digest;
2. map the account to a random internal email-like Auth alias;
3. call Supabase Auth password sign-in server-side using that alias;
4. use Supabase SSR access/refresh cookies;
5. keep application role, status, forced-change state, and `auth_version` in `app_private.user_accounts`;
6. disable public signup and generic recovery;
7. apply generic errors, throttling, lockout, revocation, and admin step-up.

## Rejection evidence — 2026-08-29

Supabase's current JWT documentation identifies `email` as a required access-token claim for email/password Auth users. Required claims cannot be removed to make an Auth access JWT opaque to the application. A user whose synthetic email-like alias is used for password sign-in therefore carries that alias in the access token.

Sending the normal Supabase SSR access token to the browser—even only in an HttpOnly cookie—would place the synthetic alias in browser-held session material. That violates this ADR's own alias-invisibility acceptance criterion.

The product will not weaken that criterion simply to keep the provider-managed session design. The documented fallback, application-owned credentials plus opaque sessions, is accepted in ADR-0007.

## Options considered

### Option A: Supabase Auth with private alias bridge — rejected

The provider would own password hashing and refresh-token rotation, but the synthetic identifier cannot satisfy the required browser-invisibility boundary when it is a required access-token claim.

### Option B: Custom employee credentials and opaque sessions — selected

This exactly fits employee-number semantics and keeps browser session material opaque. The project takes responsibility for Argon2id credential hashing, token generation/hashing, rotation, expiry, revocation, cookies, rate limiting, and comprehensive security tests. See ADR-0007.

### Option C: Email/phone password, SSO, or passkey identity — deferred

Provider-supported identity could be reconsidered later, particularly for stronger MFA, but it changes the required employee-number login experience.

### Option D: Shared facility code or weak common PIN — rejected

A shared credential removes individual attribution and makes revocation/audit ineffective.

## Owner decisions preserved

- Officers and administrators use individual passcodes with a minimum length of at least eight characters. ADR-0007 raises the implementation floor to 10 characters for this release.
- The implementation rejects common patterns and a passcode equal to the normalized employee number.
- The owner is the first/main administrator and sole initial authority for account creation, resets, unlocks, and temporary-secret delivery.
- Administrator MFA remains deferred only for the fictional-data hobby boundary and must be reconsidered before official adoption or real operational/personnel data.

## Closed action items

1. Final credential policy moved to ADR-0007.
2. The alias approach was rejected before creating real Auth users because provider token semantics already fail the required invisibility criterion.
3. No public signup/recovery or synthetic-alias account lifecycle will be built.
4. SSR Auth-token cookies are replaced by opaque application sessions.
5. Enumeration, lockout denial, credential storage, bootstrap, and session threat cases move to ADR-0007's acceptance tests.
6. Product/security selection is recorded in ADR-0007.

## References

- Replacement ADR: `docs/adr/0007-custom-opaque-employee-sessions.md`
- Supabase JWTs: https://supabase.com/docs/guides/auth/jwts
- Supabase Custom Access Token Hook: https://supabase.com/docs/guides/auth/auth-hooks/custom-access-token-hook
