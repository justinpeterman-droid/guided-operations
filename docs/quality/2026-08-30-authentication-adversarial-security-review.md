# Authentication adversarial security review — current-main revalidation

- **Date:** 2026-08-30
- **Evidence label:** MANUAL (agent-assisted review; not an approved penetration test)
- **Original review scope:** deleted `feat/milestone-1-opaque-auth` / PR #4
- **Current revalidation scope:** current `main` after migration to the accepted server-only Supabase Auth alias-bridge architecture
- **Source of truth:** ADR-0003, `SECURITY.md`, `docs/architecture/auth-rbac-rls.md`
- **Status:** Historical findings retained as adversarial hypotheses; current-main Phase 1 revalidation in progress

## Important scope correction

The original review was performed against the custom opaque-session implementation in the now-deleted PR #4. Current `main` uses a materially different authentication architecture: server-only Supabase Auth alias lookup, encrypted server-managed session cookies, provider JWT claims, authoritative current-account/auth-version checks, isolated Auth administration, and purpose-bound administrator step-up.

Therefore the original severity labels are **not current-main vulnerability claims**. A finding is actionable only after it is reproduced against the current release candidate. Findings that depended on the discarded opaque-session design are classified `SUPERSEDED / RE-TEST` rather than fixed or open.

## Current-main controls confirmed before revalidation

- `authorizeCurrentSession()` verifies provider claims, loads authoritative application account state, compares identity/auth-version state, and fails closed on mismatch.
- Purpose-bound administrator step-up implementation and protected step-up routes exist for high-impact account, retention, legal-hold, and paperwork operations.
- The accepted architecture requires encrypted HttpOnly server cookies, authenticated `private, no-store` responses, CSRF/origin validation for mutations, last-admin protection, bootstrap controls, and direct authorization/RLS negative testing.

## Phase 1 revalidation order

1. Passcode-change takeover / fresh re-authentication.
2. Lockout-extension denial of service.
3. Central forced-change/status/auth-version authorization enforcement across protected routes/actions.
4. Authenticated cache-control behavior.
5. Employee enumeration and timing behavior.
6. Database grant/RLS bypass matrix.
7. Administrator step-up replay, wrong-purpose, expiry, and auth-version binding.
8. Bootstrap/reset/unlock ceremonies.
9. Browser Supabase trust boundary.
10. Login/logout audit coverage and remaining low-severity hygiene.

No remediation is to be implemented from this document until current-main evidence reproduces the hypothesis.

## Historical finding disposition

| ID | Historical severity | Current-main disposition | Reason / required evidence |
|---|---|---|---|
| C-1 | Critical | SUPERSEDED / RE-TEST | Original arbitrary opaque-session minting path belonged to discarded PR #4. Re-test dedicated pre-auth/Auth-admin credentials and direct database grants against current alias bridge. |
| C-2 | Critical | SUPERSEDED / RE-TEST | Purpose-bound admin step-up now exists. Re-test replay, wrong-purpose, expiry, auth-version and route coverage. |
| H-1 | High | RE-TEST NOW | Verify personal passcode change requires current credential or equivalent fresh authority and cannot be completed with a stolen session alone. |
| H-2 | High | ARCHITECTURE RE-EVALUATION | Original device/network fields belonged to opaque sessions. Evaluate current encrypted/provider session theft controls and admin assurance requirements instead. |
| H-3 | High | RE-TEST NOW | Exercise current provider/application lockout behavior for attacker-driven indefinite extension. |
| H-4 | High | RE-TEST NOW | Verify deny-by-default current-account gate on every protected route/action, including forced-change and stale auth-version states. |
| H-5 | High | SUPERSEDED / RE-TEST | Opaque-session secret rotation callers no longer define current architecture. Verify encrypted provider refresh/rotation and revocation instead. |
| M-1 | Medium | RE-TEST | Compare current known/unknown/disabled/locked login paths and hosted timing distributions. |
| M-2 | Medium | RE-TEST | Verify passcode replacement applies authoritative employee-number/common/sequence rules. |
| M-3 | Medium | RE-TEST | Verify authenticated pages and APIs emit `Cache-Control: private, no-store`. |
| M-4 | Medium | RE-TEST | Validate current edge/origin global throttling cannot cheaply deny all users. |
| M-5 | Medium | RE-TEST | Original scrypt CPU claim is architecture-specific; evaluate current provider + lookup cost under abuse. |
| M-6 | Medium | RE-TEST | Confirm browser Supabase clients cannot become an unreviewed direct product-data/Auth path. |
| M-7 | Medium | RE-TEST | Verify current dedicated pre-auth function grants and negative role tests. |
| M-8 | Medium | RE-TEST | Current architecture documents bootstrap/reset/unlock; verify implementation and operator evidence. |
| M-9 | Medium | RE-TEST | Run explicit negative SELECT/INSERT/UPDATE/DELETE/RPC tests for anon/authenticated/dedicated roles. |
| L-1 | Low | RE-TEST | Verify logout intent safely expires local authority even when CSRF/origin validation fails. |
| L-2 | Low | RE-TEST | Validate production forwarding/network assumptions and fail-safe behavior. |
| L-3 | Low | RE-TEST | Compare malformed/valid employee-number observable work. |
| L-4 | Low | RE-TEST / DOC HYGIENE | Search current docs/migrations for obsolete scrypt/Argon2id/custom-session claims. |
| L-5 | Low | RE-TEST | Verify allowlisted, content-free login/logout operational audit events. |

## Release rule

This document is an adversarial regression checklist, not proof of vulnerability and not proof of security. Current-main findings move to `CONFIRMED` only with reproducible evidence against the exact candidate. They move to `CLOSED` only with evidence showing the relevant boundary is enforced and regression-tested. Hosted-only hypotheses remain open qualification gates until hosted evidence exists.
