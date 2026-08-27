# ADR-0003: Employee Number Plus PIN-Like Authentication

- **Status:** Accepted for implementation; security verification in progress
- **Date:** 2026-08-25
- **Deciders:** Product owner, security owner, and technical lead

## Context

Users need the familiar employee-number plus PIN-like sign-in experience. The
system must use individual accounts and cannot use the former shared
access/admin codes. Hosted Supabase password Auth accepts email or phone
identifiers, not an arbitrary employee-number username. A final implementation
decision is required before production code can claim this requirement is
complete.

The original foundation stored no real operational records, but authentication
metadata still deserved production-grade protection. The owner later authorized
real operational and personal data only in isolated Production after release
gates; that change raises the acceptance bar and does not make this Proposed ADR
accepted.

## Proposed decision

Prefer a server-only Auth alias bridge, subject to a hosted Supabase spike and
security approval:

- Normalize employee number and resolve it by a keyed lookup digest in the
  non-exposed `app_private` schema.
- Map the account to a random, non-user-facing Auth alias.
- Call Supabase Auth password sign-in on the server using that alias.
- Use the server-only Supabase JavaScript client with custom encrypted session
  storage. Raw access/refresh values and the provider user object remain on the
  server; the browser receives only an authenticated ciphertext envelope.
- Keep application role, status, forced-change state, and auth_version in
  `app_private.user_accounts` and recheck them server-side.
- Disable public signup and generic email/phone recovery.
- Use a password-class PIN-like secret with a proposed minimum of eight
  characters; reject employee-number equality/common sequences.
- Apply account/device/network/global limits and generic errors.
- Use protected Auth admin operations for account creation/reset only after
  active-admin, CSRF, idempotency, and purpose-bound step-up checks.

The owner approved Option A on 2026-08-25. Implementation and verification
remain mandatory before any account or sign-in route is enabled. If the alias
lifecycle cannot be made safe, choose Option B rather than reducing credential
strength or exposing aliases.

## Options considered

### Option A: Supabase Auth with private server-only alias bridge

| Dimension            | Assessment                                   |
| -------------------- | -------------------------------------------- |
| User experience      | Meets employee number + PIN-like requirement |
| Supabase integration | Strong after adapter                         |
| Security complexity  | Medium-high                                  |
| Custom cryptography  | Narrow AES-GCM cookie envelope               |
| Status               | Preferred, requires spike                    |

Pros:

- Supabase owns password hashing and session rotation.
- Works with Auth JWT identity and RLS.
- Browser never learns the synthetic alias or receives a decodable Auth token.
- Preserves the practical login UI.

Cons:

- Relies on a non-user-facing email-like alias behavior that must be validated.
- Auth admin API secret is powerful and must be isolated.
- Generic recovery/email flows do not naturally fit.
- JWT revocation is not instantaneous without current account checks/short TTL.
- The application owns encryption-key custody, chunk compatibility, and a
  planned sign-in-again event whenever that key rotates.

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
- The forced-change screen accepts no other workspace action. It requires the
  current session, exact same-origin request, session-bound CSRF proof, and a
  second keyed employee-number match before replacing the provider credential.
  Completion atomically clears the unexpired forced-change state, records only
  an allowlisted audit outcome, advances `auth_version`, and attempts global
  provider session revocation. A successful local implementation does not prove
  hosted Auth behavior until protected-Preview browser evidence exists.
- Login/account/device/network/global rate limits and bounded lockout work.
- Secure HttpOnly SameSite cookies, refresh rotation, expiry, logout,
  logout-all, reset, deactivation, and role change pass real-browser tests.
- Current account role/status/auth_version is checked on sensitive requests.
- Auth admin secret is server-only and isolated from routine DAL clients.
- Purpose-bound single-use admin step-up and last-admin protection pass tests.
- Complete grants/RLS matrix passes direct bypass attempts.
- First-admin bootstrap and secret delivery have an approved runbook.

## Owner decisions — 2026-08-25

- Officers and administrators use individual passcodes with a minimum length of
  eight characters. The implementation must also reject common patterns and a
  passcode equal to the normalized employee number.
- The owner is the first/main administrator and is the sole initial authority to
  create accounts, reset passcodes, unlock accounts, and deliver temporary
  secrets.
- Administrator MFA was deferred only for the no-data foundation. That exception
  does not cover the current real-data Production target; MFA or an explicitly
  approved, tested equivalent remains an acceptance gate.
- The owner approved Option A, the private server-only Supabase alias bridge, on
  2026-08-25. This authorizes implementation only; it does not waive the
  security acceptance criteria or authorize real operational data.

## Hosted alias-spike evidence — 2026-08-25

The disposable hosted Auth-spike project was used only with one random,
non-deliverable `invalid.example` alias and a generated test secret. The account
was created through a server-side administrative path, marked email confirmed,
signed in successfully through the ordinary password endpoint, and was
immediately deleted. No alias, secret, access token, refresh token, or
test-account identifier was retained in this repository or report.

Observed results:

- the internal alias can authenticate with a password and issue a normal
  access/refresh session;
- Auth returns that alias only to the server-side caller, so the product must
  never forward the provider user object or error body to a browser, log, audit
  event, analytics sink, or public endpoint;
- a known alias with the wrong secret and a random unknown alias both received
  the same HTTP failure status (`400`) from the provider endpoint;
- the spike project's default settings still allowed public signup and required
  email confirmation. Those settings are unsuitable for this product and must be
  disabled/configured through the approved protected configuration path before
  any development or live account exists.

This evidence supports Option A but does not accept it. It does not yet prove
the required hosted cookie lifecycle, recovery/email absence, rate limits,
enumeration timing bounds, Auth-admin isolation, bootstrap ceremony, or RLS
authorization matrix.

## Implementation evidence — 2026-08-26

The repository now contains a server-only guarded sign-in service and private
PostgreSQL attempt-store adapter. Before an alias lookup, it evaluates account,
device, network, and global windows using purpose-separated HMAC digests. It
records only opaque subject digests and an `allowed`, `denied`, or `failed`
outcome in `app_private.auth_attempt_events`. Focused unit tests cover all four
dimensions, generic denials, and success/failure recording.

This is implementation evidence only: the browser sign-in route exists but fails
closed with a 404 unless the server-only `AUTH_SIGN_IN_ENABLED` setting is
explicitly enabled. There is no hosted account, public recovery path, or
operational data. Hosted integration, timing measurement, trusted
proxy/device-subject derivation, cookie expiry/revocation, reset/bootstrap, and
authorization/RLS negative tests remain open.

The pre-auth request helper also converts the Vercel-managed client-network
header and a random HttpOnly device-cookie value into purpose-separated HMAC
digests before rate-limit storage. It has no raw-IP persistence path. A missing
provider header falls back to a shared opaque network subject while the device
and global limits remain active. This too remains unenabled until the full sign-
in route and lifecycle checks are ready.

The server composition factory joins the private alias lookup, private attempt
store, SSR password authenticator, and server-only secrets. It requires a
reviewed rate-limit policy argument instead of assigning a hidden production
threshold. It creates no public identity, browser-readable credential, or
recovery channel.

The password exchange now returns an Auth user ID only to the server, and the
employee sign-in service rejects it unless it equals the ID bound to the private
alias lookup. A mismatched identity receives the same generic failure as any
other unsuccessful credential attempt.

The initial route boundary now accepts only exact same-origin JSON POSTs and
validated bounded employee-number/passcode fields. It sets no-cache responses
and an opaque HttpOnly device cookie only after a valid same-origin request,
including a generic credential failure. The route is fail-closed: it returns 404
unless the server-only `AUTH_SIGN_IN_ENABLED` setting is explicitly `true`; the
provided environment example leaves it `false`. The preview rate-limit policy is
5 account, 10 device, 25 network, and 200 global attempts per 15 minutes. These
limits must be exercised with fictional Preview traffic and revisited before
live promotion.

The protected Reports workspace now supplies a visible local sign-out control.
It first obtains a fresh session-bound CSRF token, then calls the same-origin
sign-out route. That route rechecks the current account, exact origin, and CSRF
proof before ending only the current provider session and clearing the private
device and CSRF cookies. A separate same-origin, CSRF-protected sign-out-all
route now revokes the authenticated account's provider sessions globally and
clears those local safety cookies. Focused route and browser-component tests
cover the local sign-out success, failed, and denied cases; focused route tests
cover global revocation success and denied cases. Reset, disabled-account, and
role-change revocation proof remain separate acceptance requirements.

## Encrypted session evidence — 2026-08-27

Supabase requires the synthetic email-like alias in the Auth access-token
claims, so removing the alias from that JWT is not a supported solution. The
repository therefore replaced the browser-readable SSR cookie representation
with a server-only `@supabase/supabase-js` client and custom storage backed by a
versioned AES-256-GCM envelope. The encryption key is an exact 32-byte base64url
secret; every write uses a fresh 96-bit nonce and authenticated associated data.
Cookies are bounded, strictly ordered when chunked, HttpOnly, SameSite=Lax,
Secure outside explicit local development/test, and fail closed by expiring all
session chunks after malformed or unauthenticated input.

The local integration test signs in a fictional Shift A officer through the real
local Auth provider, verifies provider claims and current-account RLS authority,
forces refresh-token rotation, and proves the browser-cookie representation
contains neither alias nor access/refresh token. The real browser qualification
additionally proves `document.cookie` cannot read the session,
saves/reopens/prints a fictional Count Sheet, signs out, observes all session
chunks removed, and is denied on the next protected request. Public signup
remains disabled. No real identity or operational data is used.

This closes the local alias-in-cookie finding and preserves employee-number
sign-in and RLS identity. It does not close the separate hosted gates for
recovery/email configuration, expiry, global revocation, disabled/reset/role
invalidation, multi-device behavior, or protected-Preview qualification.

## Threat model — 2026-08-25

This threat model was written for the no-data foundation. It remains historical
evidence but does not qualify the current real-data Production target without
the additional acceptance evidence required by this ADR and the release gates.

| Threat                                            | Required control                                                                                                                                        | Required evidence before acceptance                                                                                  |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Employee-number enumeration or timing comparison  | Keyed lookup digest, a dummy password-auth path for unknown accounts, generic external responses, and bounded timing tests                              | Known/unknown/disabled/locked cases have indistinguishable public responses and measured bounded timing difference   |
| Credential stuffing and lockout denial of service | Account, device, network, and global rate limits; short bounded lockouts; administrator unlock only after step-up                                       | Direct route tests cover each dimension, retry guidance, lock expiry, unlock, and distributed failure behavior       |
| Stolen refresh token or stale JWT                 | Server-only encrypted HttpOnly SameSite cookies, provider refresh rotation, short expiry, and current `auth_version`/status check on protected requests | Browser tests prove rotation, logout, logout-all, reset/status/role-change invalidation, and rejected stale sessions |
| Auth-admin secret misuse                          | Separate server-only admin adapter, no routine request access, purpose-bound administrator step-up, audit allowlist                                     | Static secret scan, adapter-boundary tests, authorization tests, and a denied direct routine-DAL attempt             |
| Alias disclosure or public recovery               | Alias remains server-only; no provider user/error forwarding; no recovery UI or product call; public signup disabled                                    | Browser/network/log/audit/redirect checks and a hosted Auth configuration review                                     |
| Bootstrap or last-admin loss                      | Transactional zero-account bootstrap, generated temporary secret, one-time protected delivery, lifecycle trigger, and last-admin check                  | Rollback-only database tests plus first-admin and last-admin integration tests without credentials in logs           |
| Cross-account/role data access                    | Current-account server gate plus operation-specific RLS and narrow grants                                                                               | Direct database/API/Storage negative matrix for officer, administrator, disabled, missing, and unrelated identities  |
| CSRF and unsafe redirects                         | Exact Origin/Fetch-Metadata validation, CSRF token, closed schemas, and allow-listed redirects                                                          | Route/browser tests for cross-site POST, missing/invalid token, and hostile redirect targets                         |

The lifecycle trigger and current-account gate now cover only portions of the
bootstrap, stale-session, and last-admin controls. They do not satisfy this
threat model by themselves.

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
2. [x] Spike random internal aliases on a disposable hosted Supabase project.
3. [ ] Complete hosted email/recovery/alias non-exposure proof and document the
       hosted account lifecycle. Local cookie/browser non-exposure is proven.
4. [ ] Complete hosted expiry and revocation qualification. The encrypted
       server-only cookie, local refresh rotation, local sign-out, and protected
       fictional vertical slice are implemented and passing.
5. [x] Threat-model enumeration, lockout denial, Auth admin secret, and
       bootstrap requirements are recorded above. Implement and test each listed
       control before acceptance.
6. [ ] Obtain product/security acceptance or record Option B as a new ADR.

## References

- [Supabase JavaScript Auth storage](https://supabase.com/docs/reference/javascript/auth)
- [Supabase Custom Access Token Hook required claims](https://supabase.com/docs/guides/auth/auth-hooks/custom-access-token-hook)
- [Supabase user sessions and refresh rotation](https://supabase.com/docs/guides/auth/sessions)
