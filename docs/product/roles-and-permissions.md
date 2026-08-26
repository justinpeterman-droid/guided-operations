# Roles and Permissions

## Scope and assumptions

The initial product serves one configured facility and has two interactive
roles: **officer** and **administrator**. “Supervisor,” “reporting officer,”
“preparing officer,” “reviewer,” and shift/rank labels describe operational
relationships; they do not grant application permissions unless an approved role
model later says otherwise.

The current build and validation boundary permits fictional operational records
only. These permissions still need to be implemented and tested as if the data
were sensitive.

## Identity model

Keep four concepts separate:

1. **Authentication identity** — the server-verifiable identity associated with
   a Supabase Auth subject or equivalent session principal.
2. **Web account** — employee number, account state, role, credential lifecycle,
   lockout state, and session policy.
3. **Staff profile** — display name, job/rank metadata, shift, active/inactive
   state, and other approved directory fields.
4. **Incident relationship** — reporting officer, preparing officer,
   participant, editor, or administrator attribution on a particular
   incident/report.

A staff profile may exist before an account is activated. Deactivating a staff
profile must not erase historical attribution. Employee number is a login
identifier, not a public database key and not proof of authorization by itself.

## Authentication contract

The user-facing sign-in contract is employee number plus a PIN-like secret.

- Normalize employee numbers on the server using one documented rule; preserve
  the approved display format separately.
- Never store or log a plaintext PIN.
- Use a modern password/PIN hashing function or the selected identity provider's
  protected credential store.
- Enforce minimum length, blocked/common-secret checks, retry throttling,
  lockout or backoff, and generic failure messages.
- Rate limits must cover employee number, IP/network signals, device/session,
  and global abuse without revealing whether an employee number exists.
- Credential reset creates a system-generated, time-limited temporary
  credential; administrators do not choose or retrieve an existing PIN.
- Require the employee to replace a temporary credential after successful
  sign-in.
- Rotate the session identifier after sign-in, role change, step-up, and
  credential change.
- Store browser sessions in `HttpOnly`, `Secure`, appropriately scoped cookies.
  Do not store bearer/session tokens in `localStorage`.
- Revoke affected sessions after deactivation, credential reset, or suspected
  compromise.
- Require recent authentication or administrator step-up for role changes,
  credential resets, account state changes, and high-impact incident actions.

If Supabase Auth cannot directly represent the employee-number/PIN contract
safely, use a server-side identity adapter. Do not invent synthetic email
addresses in client code or expose the Supabase service role key to the browser.

## Authorization rules

1. Deny by default.
2. Enforce permissions on every server mutation and read, not only in
   navigation.
3. Keep application tables behind the server data-access layer and apply
   Postgres row-level security as defense in depth; force RLS where appropriate.
4. Keep service-role and database-owner credentials in server-only code with
   narrow use cases.
5. Use least-privilege grants; the normal application path never connects as a
   superuser.
6. Index the columns used by RLS and common authorization filters, including
   account subject, facility scope, incident ownership/relationship, and active
   state.
7. Use explicit constraints and foreign keys for role, account state,
   attribution, and revision relationships; index every foreign key used for
   lookup or cascade.
8. Add server-side checks in addition to RLS for business rules such as allowed
   state transitions, base revision, and step-up recency.
9. Negative authorization tests are required for every protected resource and
   action.
10. A missing role, relationship, or facility scope is a denial, not a fallback
    to broader access.

## Interactive permission matrix

“Own/authorized” means the employee is explicitly related to the incident/report
under the approved incident-access rule. The exact relationship rules are a
migration work item and must be encoded once in server policy helpers and RLS.

| Capability                                         | Officer                                              | Administrator                                                 |
| -------------------------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------- |
| Sign in, sign out, view own profile                | Yes                                                  | Yes                                                           |
| Change own PIN-like credential                     | Yes; recent authentication required                  | Yes; recent authentication required                           |
| View and revoke own sessions                       | Yes                                                  | Yes                                                           |
| View officer Home summary                          | Own/authorized work only                             | Own/authorized work; admin entry is separate                  |
| Create an incident draft                           | Yes                                                  | Yes, with explicit preparing/admin attribution                |
| View an incident                                   | Own/authorized only                                  | Facility-wide, audited                                        |
| Edit incident notes or proposed facts              | Own/authorized and permitted workflow stage          | Facility-wide when elevated; action attributed                |
| Confirm incident facts                             | Own/authorized                                       | Yes when elevated; action attributed                          |
| Generate/review report drafts                      | Own/authorized                                       | Yes when elevated; action attributed                          |
| Edit an officer report                             | Reporting/preparing relationship and permitted state | Yes when elevated; original reporting officer remains visible |
| Print/download supported report                    | Only when allowed for that report and state          | Yes when allowed; audited                                     |
| Copy records-system text                           | Own/authorized; deliberate action                    | Yes when elevated; deliberate and audited                     |
| Add/remove optional paperwork                      | Own/authorized and permitted state                   | Yes when elevated                                             |
| Acknowledge physical paperwork                     | Own/authorized; does not replace official form       | Yes when elevated; attribution required                       |
| Use Forms Library                                  | Yes                                                  | Yes                                                           |
| Use NCU Days Count                                 | Own created/authorized count records                 | Facility-wide oversight only if explicitly implemented        |
| Ask Policy Expert                                  | Yes                                                  | Yes                                                           |
| Read full authorized policy source                 | Yes, through authorized opaque source ID             | Yes; same source authorization applies                        |
| See all facility incidents                         | No                                                   | Yes, after admin authorization/step-up as required            |
| Close, reopen, transfer, archive incident          | No                                                   | Yes; explicit transition, reason, and audit required          |
| View Daily/Weekly/Monthly Paperwork Center         | No by default                                        | Yes                                                           |
| Create/edit facility paperwork records             | No by default                                        | Yes; revision and autosave safeguards apply                   |
| View staff directory                               | Only the minimum picker fields needed for a workflow | Yes                                                           |
| Create/activate/deactivate web accounts            | No                                                   | Yes; step-up required                                         |
| Change roles or issue temporary credential         | No                                                   | Yes; step-up and dual-confirmation policy as defined          |
| View security/audit events                         | No                                                   | Yes, filtered and redacted                                    |
| View system health                                 | No                                                   | Yes; no secrets or sensitive payloads                         |
| Manage RAG corpus objects or provider keys         | No                                                   | No through ordinary product administration                    |
| Deploy, migrate schema, alter RLS, restore backups | No                                                   | No through ordinary product administration                    |

## Non-human roles

Non-human access belongs to deployment and background services, not to
interactive administrators.

| Principal              | Allowed                                                                     | Forbidden                                                                                     |
| ---------------------- | --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Vercel server runtime  | Authorized server queries/mutations, signed object access, AI orchestration | Interactive login, unrestricted table scans, exposing provider/service keys to client bundles |
| Migration runner       | Apply reviewed migrations in the named environment                          | Runtime browsing, modifying production outside the reviewed migration                         |
| Background job worker  | Claim bounded queued jobs, write validated results and status               | Reading unrelated incidents, bypassing idempotency, persisting raw model prompts by default   |
| Corpus ingestion job   | Read authorized source objects, write page/chunk/index records              | Reading operational records, publishing source files, changing rights decisions               |
| Monitoring integration | Receive redacted health/error metadata                                      | Receiving narratives, PINs, policy questions, full source excerpts, tokens, or signed URLs    |

Each non-human principal needs a named owner, narrow credentials, rotation
procedure, audit trail, and documented revocation path.

## RLS and server-policy acceptance

For every protected table, maintain a policy matrix containing operation,
database role, condition, and test. At minimum, test:

- unauthenticated denial;
- active officer allowed for an authorized row;
- active officer denied for another employee's row;
- inactive/locked account denied;
- administrator allowed only through the approved facility scope and step-up
  rules;
- role downgrade takes effect for new requests and sessions are
  refreshed/revoked as required;
- direct REST/database API attempts cannot bypass the Next.js UI;
- service principals can access only their documented tables/actions;
- object storage policies mirror database authorization and prevent
  predictable-path enumeration.

Authorization predicates should call stable helper functions once per statement
where possible, and every predicate column must have a supporting index.
Performance is part of security: a policy that times out under expected load is
not an acceptable control.

## Decisions still required before implementation acceptance

- Exact employee-number normalization and display rules.
- PIN length, retry, lockout/backoff, and reset expiry policy.
- Officer incident-access rule after handoff, reassignment, or shift change.
- Whether administrators require step-up on every admin entry or only sensitive
  actions, and the maximum step-up age.
- Session maximum age, idle timeout, concurrent-session limit, and
  trusted-device policy.
- Which minimal staff fields officers may see in pickers.
- Count Sheets are **shift-shared**: active officers with the same
  administrator-assigned `shift_code` may view and work on the same shift’s
  sheet. A missing shift assignment grants no Count Sheet access. This decision
  does not grant unrelated report or administrative access.
- The initial Count Sheet shift codes are: `A` and `B` for day shift; `C` and
  `D` for night shift; `U` for five-day week; and `F` for five-day-week field.
- Protected administrator account creation requires one of those shift codes.
  The administrator roster shows and changes the assignment only after a fresh,
  purpose-bound administrator passcode check. A change revokes the target's
  existing sessions and records only bounded prior/new shift codes in audit.
- Retention and legal-hold requirements for account, audit, incident, report,
  and generated-artifact data if real operational use is later approved.
