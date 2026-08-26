# Authentication, RBAC, and RLS

- **Status:** Target design with one unresolved implementation decision
- **Critical decision:** ADR-0003 must be accepted before production login

## Required user experience

The sign-in screen asks for:

1. employee number; and
2. a private PIN-like secret.

There is no email/phone entry, shared facility code, self-signup, or public
recovery flow.

“PIN-like” describes a fast, familiar interaction. It does not authorize a weak
four-digit credential. The proposed floor is at least eight randomly resistant
characters with an approved alphabet, common/sequence/employee-number checks,
rate limiting, and system-generated temporary credentials. The final alphabet,
length, admin MFA requirement, and lifecycle require owner/security approval.

## Why the implementation is proposed

Hosted Supabase password sign-in natively accepts email+password or
phone+password, not an arbitrary employee-number username. Pretending otherwise
would leave a design hole.

The preferred spike is a **server-only Auth alias bridge**:

1. Normalize the submitted employee number using one versioned rule.
2. Compute a keyed lookup digest with an environment secret.
3. Call a private login-lookup function through a dedicated server-only
   execute-only database role; resolve an active `app_private.user_accounts` row
   and random internal Auth alias.
4. For a missing row, continue through a constant/generic dummy Auth path.
5. Call Supabase Auth signInWithPassword server-side using the internal alias
   and submitted PIN-like secret.
6. Establish the supported SSR cookie session.
7. Load current account status, role, forced-change state, and auth_version.
8. Return one generic failure for unknown account, wrong secret, inactive
   account, or disallowed state.

The internal alias is never user-facing, searchable through product APIs, or
logged. Accounts are created by a protected administrator/operator path; Auth
email delivery, confirmation, and generic recovery are disabled for the alias.
The pre-auth database credential cannot read product tables or call general
application functions, is unavailable to browser bundles, and must work through
the qualified serverless connection pool. Using the broad Supabase service role
for this routine lookup is prohibited.

Every access token used for an application mutation must carry a positive
`app_metadata.auth_version` claim written by the reviewed Custom Access Token
Hook. The server compares that claim to the current-account RPC result before
authorizing. Missing/malformed hook output is a fail-closed session denial;
`user_metadata` is never an authorization source. Enabling the hook in the
hosted project and proving refresh/revocation remain required integration gates.

The spike must prove that a non-deliverable/random alias is supported by the
hosted Auth lifecycle, remains invisible, does not trigger outbound mail, and
works with SSR refresh/revocation. If it cannot, use the custom opaque-session
option in ADR-0003 rather than weakening the boundary.

## Credential policy

Minimum proposed rules:

- 8-12 or more characters; exact range decided after usability/security test;
- letters and digits at minimum, with unambiguous display for generated
  temporary values;
- case behavior explicitly defined and consistent;
- cannot equal normalized employee number;
- reject repeated values, ascending/descending sequences, common credentials,
  and known breached values where the selected plan supports checking;
- system-generated temporary secret, short expiry, forced first change;
- no operator/user-supplied first-admin secret in workflow input;
- never log, echo after initial protected delivery, store in application tables,
  or persist in idempotency response bodies;
- credential change and reset invalidate existing authority/sessions according
  to the qualified Auth design.

If the product owner requires fewer than eight characters, this ADR remains
unapproved for production.

## Account lifecycle

States:

- pending
- active
- locked
- disabled

Transitions require idempotency and audit metadata. Deactivation, role change,
credential reset, and logout-all increment auth_version and revoke/invalidate
sessions as far as the provider supports. Because access JWTs can remain valid
until expiry, the BFF checks current account status/auth_version on every
sensitive request rather than relying solely on token age.

The last active administrator cannot be demoted or disabled. First-admin
bootstrap is allowed only when no application account exists, uses a
transaction-level advisory lock, generates the temporary secret inside the
protected operation, and delivers it through an authorized custodian channel.

## Login abuse controls

- Normalize before digesting; reject malformed values before expensive Auth work
  but keep public error text generic.
- Apply sliding/fixed windows across lookup account, device cookie, network
  digest, and global endpoint.
- Use keyed digests for network/device subjects and bounded retention.
- Add exponential backoff after repeated failures with an administrator unlock
  path; tune to avoid an easy permanent account-denial attack.
- Equalize the observable path for missing and existing accounts where
  practical.
- Return 429 with generic retry guidance and no account-existence signal.
- Alert on distributed failures, repeated admin targeting, and unusual reset
  activity without logging raw identifiers.

## Session design

- Use the current supported Supabase SSR package/flow.
- Access and refresh credentials live in Secure, HttpOnly, SameSite=Lax cookies.
- Cookie Domain is omitted unless a reviewed cross-subdomain requirement exists.
- Cookie Path is as narrow as compatible with the framework/Auth refresh flow.
- Never use localStorage for Auth tokens.
- A server proxy/refresh boundary verifies tokens using the provider-recommended
  claims/user call; it is a convenience gate, not the sole authorization layer.
- Logout, refresh rotation/reuse behavior, expiry, disabled account, logout-all,
  and multi-device revocation receive browser integration tests.
- Authenticated pages and APIs are private/no-store.

## CSRF and same-origin policy

Every state-changing cookie-authenticated request must:

- use POST/PATCH/PUT/DELETE, never GET;
- require a session-bound double-submit or synchronizer CSRF token;
- compare with constant-time semantics where applicable;
- validate Origin against the configured HTTPS application origin;
- reject Sec-Fetch-Site cross-site where provided;
- accept only the expected content type and closed body schema.

SameSite cookies reduce risk but do not replace CSRF validation.

## Roles

Initial roles are deliberately small:

- officer
- administrator

Do not add supervisor, auditor, facility, or tenant roles without a use case,
matrix update, RLS tests, and ADR amendment.

## RBAC/ownership matrix

| Resource/action                          | Officer                  | Administrator       | Extra control                                  |
| ---------------------------------------- | ------------------------ | ------------------- | ---------------------------------------------- |
| Own/preparer incident/report read        | Allow                    | Allow               | RLS ownership/access                           |
| Own/preparer incident/report edit/export | Allow                    | Allow               | CSRF, idempotency, base revision               |
| Other officer's record                   | Deny/conceal             | Allow               | Admin elevation for sensitive views as decided |
| Restore own record                       | Allow                    | Allow               | Idempotency; admin restore step-up             |
| Transfer ownership                       | Deny                     | Allow               | Purpose-bound step-up                          |
| Staff display list                       | Minimum fields           | Full safe admin DTO | No auth internals                              |
| Create/change/deactivate account         | Deny                     | Allow               | Purpose-bound step-up; last-admin rule         |
| Reset credential/unlock/revoke sessions  | Self-limited routes only | Allow               | Purpose-bound step-up for target account       |
| View audit                               | Deny                     | Allow               | Elevated admin                                 |
| Export audit/bulk reports                | Deny                     | Allow               | Purpose-bound step-up                          |
| Ask policy question                      | Allow                    | Allow               | Auth, rate limit, corpus access                |
| Ingest/activate corpus version           | Deny                     | Allow               | Purpose-bound step-up and evaluation gate      |
| Queue/job status                         | Own/authorized target    | All                 | No raw payload                                 |

## RLS design

### Identity source

RLS starts from `auth.uid()`, maps it to
`app_private.user_accounts.auth_user_id`, and requires active status. Role and
auth_version come from authoritative application rows, not user-editable
metadata.

Create small private helper functions such as:

- current_account_id()
- current_account_is_active()
- current_account_is_admin()
- can_read_incident(incident_id)
- can_access_report(report_id)

Functions are stable only when semantically safe, use an empty search_path,
qualify objects, and avoid recursive RLS. Index auth_user_id, owner/preparer
foreign keys, report_access account/report keys, and every policy predicate.

### Policy rules

- Enable and force RLS on user/record/revision/job/export/corpus access tables.
- Revoke all from anon.
- Grant authenticated only the narrow API functions/views needed.
- Use separate SELECT/INSERT/UPDATE/DELETE policies; avoid opaque FOR ALL rules.
- INSERT WITH CHECK derives actor/owner from auth.uid() mapping, not request
  fields.
- UPDATE USING and WITH CHECK both preserve ownership and immutable columns.
- Revision/audit tables expose no update/delete path.
- Administrator policies still require active current admin status.
- Disabled/missing account resolves to no rows.
- Views use security_invoker where available or are wrapped/tested explicitly.

### Server-side DAL

RLS is defense in depth, not a replacement for DAL authorization. The DAL:

1. verifies/refreshes the Auth session;
2. loads current account state;
3. validates and authorizes the command;
4. calls a purpose-specific narrow query/RPC with the request-scoped JWT;
5. maps to a minimal DTO.

Routine user paths must not initialize a client with the Supabase secret/service
credential. Auth administration uses an isolated server-only adapter with the
admin secret, only after current admin+step-up authorization, and never shares
that client with the DAL.

## Admin elevation and step-up

An admin first enters an elevated mode with bounded idle expiry. Each
high-impact action then rechecks the credential and issues a purpose-bound
token/artifact:

- tied to account/session/auth_version;
- random and stored as a digest;
- expires in minutes;
- consumed atomically once;
- wrong purpose or replay fails;
- cleared from cookies/state after use.

TOTP MFA for administrators is strongly preferred before any real operational
data is authorized. Whether it is mandatory for the corpus-only initial release
is a final security decision.

## Authorization tests

For every route and database operation, cover:

- no session, malformed/expired session, and missing application account;
- active officer, locked officer, disabled officer, forced credential change;
- owner, preparer, explicit collaborator, unrelated user;
- active admin, stale admin claim after demotion, last-admin protection;
- absent resource versus concealed unauthorized resource;
- correct/wrong/expired/replayed step-up purpose;
- anon/authenticated/service/dedicated worker database roles;
- select/insert/update/delete and WITH CHECK behavior;
- direct API/RPC attempts that bypass the Next.js UI;
- session invalidation after reset, role/status change, and logout-all.

## Decision gate

ADR-0003 can move to Accepted only after:

- owner selects credential length/alphabet and admin MFA policy;
- the alias bridge passes a hosted Supabase spike without email/recovery
  leakage;
- server cookies and refresh/revocation behavior pass real-browser tests;
- Auth admin operations are isolated and step-up protected;
- enumeration/rate-limit/lockout tests pass;
- complete grants/RLS matrix tests pass;
- bootstrap and credential delivery have an approved operator runbook.
