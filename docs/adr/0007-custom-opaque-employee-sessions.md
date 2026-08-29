# ADR-0007: Application-Owned Opaque Employee Sessions

- **Status:** Accepted
- **Date:** 2026-08-29
- **Deciders:** Product owner, security owner, and technical lead
- **Replaces:** ADR-0003's Supabase Auth alias-token proposal

## Context

Guided Operations requires employee-number plus individual-passcode sign-in without exposing an email/phone identifier or shared facility credential. ADR-0003 preferred a server-only synthetic Auth alias only if that alias could remain absent from browser-held material.

Supabase documents `email` as a required access-token claim for password-auth users and does not permit removing required claims with a Custom Access Token Hook. The normal Supabase SSR session would therefore place the synthetic alias inside an access JWT held by the browser, even if the cookie is HttpOnly. That violates ADR-0003's alias-invisibility acceptance criterion.

The project will not weaken that criterion. The replacement uses application-owned credentials and opaque sessions while retaining Supabase PostgreSQL, private Storage, pgvector, and the existing Next.js backend-for-frontend.

## Decision

Product authentication uses these boundaries:

1. Normalize the submitted employee number and compute an HMAC-SHA256 lookup digest with `EMPLOYEE_LOOKUP_PEPPER`.
2. A dedicated server-only pre-authentication Postgres role may execute only narrowly reviewed account lookup and rate-limit functions.
3. Passcodes are stored only as Argon2id hashes in `app_private.user_credentials`.
4. Successful login creates an opaque `go_session=<uuid>.<secret>` browser cookie. The raw secret exists only in the cookie and request memory.
5. PostgreSQL stores only HMAC-SHA256 session-secret digests and a short previous-secret grace digest during rotation.
6. Next.js resolves and verifies the opaque session before protected reads or mutations, rechecking account status, role, `auth_version`, expiry, and forced-change state.
7. Authenticated database work uses a separate least-privileged runtime Postgres role. A transaction sets a verified `app.current_account_id` only after session validation; grants and RLS remain defense in depth.
8. Routine product authentication does not use Supabase Auth user sessions, browser JWTs, or the Supabase service-role/secret key.
9. Administrator elevation lasts no more than 15 minutes. High-impact actions require a purpose-bound, single-use step-up artifact that expires after 5 minutes.

## Credential policy

- User passcodes are 10-64 characters and case-sensitive.
- Control characters, the normalized employee number, common/repeated/sequence values, and known weak fixture values are rejected.
- System-generated temporary passcodes are 16 characters from an unambiguous letters-and-digits alphabet.
- Temporary passcodes expire, force first change, and are never written to logs, audit metadata, idempotency responses, or application tables in plaintext.
- Credential change/reset increments `auth_version` and revokes affected sessions in the same transaction.

## Session policy

- Cookie name: `go_session`.
- Cookie attributes: HttpOnly, SameSite=Lax, Path=/, Secure outside local development; no Domain attribute without a future reviewed need.
- Absolute lifetime: 12 hours.
- Idle lifetime: 60 minutes.
- Secret rotation begins after 30 minutes of age with a 30-second previous-secret grace window for concurrent requests.
- Disable, lock, role change, credential reset/change, and logout-all immediately invalidate affected authority through `auth_version` plus session revocation.
- Authenticated dynamic responses are private/no-store.

## Request protection

State-changing requests validate, in order:

1. opaque session and current account state;
2. role/ownership authorization;
3. closed Zod input schema;
4. configured `Origin`;
5. `Sec-Fetch-Site` when present;
6. a session-bound CSRF token;
7. idempotency/concurrency controls required by the target mutation.

UI visibility is never authorization.

## Database roles

`guided_operations_preauth`:

- no table access;
- execute only the reviewed pre-auth lookup/rate-limit functions;
- cannot read product, credential, session, audit, policy, Storage, or operational tables directly.

`guided_operations_runtime`:

- no BYPASSRLS;
- narrow schema/table/function privileges only;
- relies on verified per-transaction `app.current_account_id` plus operation-specific RLS;
- cannot read passcode hashes, raw/digested session secrets, or rate-limit internals through product DTOs.

Administrative maintenance remains separate from routine user traffic.

## Bootstrap and lifecycle

First-admin bootstrap is allowed only while no application account exists. It takes a transaction-level advisory lock, generates the temporary passcode inside the protected operation, creates the account/credential atomically, and returns the temporary secret only once to the authorized owner channel. It is never logged.

The last active administrator cannot be disabled or demoted. Account creation, role changes, resets, unlocks, deactivation, and session revocation are audited with allowlisted metadata only and require the appropriate administrator elevation/step-up.

## Security acceptance criteria

This ADR is implemented only when tests prove:

- generic bounded behavior for known and unknown employee numbers;
- Argon2id passcode verification and weak-passcode rejection;
- secure cookie creation, rotation, expiry, logout, logout-all, reset, disable, lockout, and `auth_version` revocation;
- no raw employee number, passcode, session secret, or credential hash in browser storage, logs, audit metadata, or API errors;
- pre-auth and runtime database roles cannot bypass their grants/RLS boundaries;
- missing, disabled, cross-user, and cross-role access is denied;
- administrator elevation and purpose-bound single-use step-up reject expiry, wrong purpose, and replay;
- first-admin and last-admin safety rules pass transactional tests;
- real-browser desktop/mobile authentication and forced-passcode-change flows pass.

## Consequences

- The project owns credential hashing and opaque-session rotation/revocation logic and must maintain strong tests for it.
- Supabase Auth remains available for future reconsideration but is not the product identity/session authority for this release.
- Direct PostgreSQL connectivity is server-only and must use qualified pooled connections suitable for Vercel.
- The application can preserve employee-number UX without putting a synthetic identity alias or provider token in the browser.
- Administrator MFA remains deferred only for the fictional-data hobby boundary and must be reconsidered before real operational/personnel data or official adoption.

## References

- ADR-0003: `docs/adr/0003-employee-number-pin-auth.md`
- Authentication/RBAC/RLS: `docs/architecture/auth-rbac-rls.md`
- Security policy: `SECURITY.md`
- Supabase JWT documentation: https://supabase.com/docs/guides/auth/jwts
- Supabase Custom Access Token Hook: https://supabase.com/docs/guides/auth/auth-hooks/custom-access-token-hook
