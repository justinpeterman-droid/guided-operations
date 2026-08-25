# Security Policy

## Purpose

This file defines the security boundary and invariants for automated and human
review of Guided Operations. It is scanner guidance, not proof that a control is
implemented.

The repository is private. Report suspected vulnerabilities through the
repository owner's private channel or private security reporting workflow. Do
not open a public issue, include credentials, paste policy corpus content, or
use real operational/personnel data to demonstrate a finding.

## Current state versus target

The repository now has a static foundation page, health route, Supabase client
factories, an initial locked `app_private` migration with fictional seed and
pgTAP checks, Count Sheet domain tests, and a grounded-policy schema. The empty
foundation migration is applied to a Supabase Free project in `us-east-1`. A
protected Vercel Preview is connected only to that Development project through
browser-safe configuration, and its page, liveness, and readiness endpoints have
been remotely verified. This does not enable sign-in or operational data: the
migration deliberately grants no runtime role access, and authentication,
authorized RPC/DAL paths, complete RLS policies, queues, corpus
ingest/retrieval, exports, and most controls below remain implementation work. A
missing target control is a gap; code that claims to establish a boundary but
fails to do so is a security finding.

The target is a private, internet-reachable web application:

- Next.js 16 App Router and React 19 on Vercel;
- Supabase Auth, PostgreSQL, private Storage, Queues, and pgvector;
- OpenAI through a provider-neutral server adapter;
- one optional non-Google durable worker if long document jobs require it;
- one facility and no public user registration;
- no Google hosting or Google Cloud runtime dependency.

Its present use classification is a personal, non-commercial hobby app for a
small invited group of officers. It is not an agency/facility system, and real
operational data remains prohibited. Any later official adoption reopens plan,
vendor, records, privacy, recovery, and security approval.

## Data classification

| Class                        | Examples                                                                                    | Allowed environments                                                                |
| ---------------------------- | ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Restricted reference content | Real policy manuals, forms, directives, source PDFs, derived text, embeddings               | Approved Supabase projects and authorized local ingest only                         |
| Security metadata            | Auth user IDs, employee-number lookup values, roles, account status, session/audit metadata | Environment-specific Supabase Auth/PostgreSQL; never fixtures or logs               |
| Operational product data     | Incidents, inmate details, reports, field notes, rosters, paperwork                         | Fictional only until a separate owner/security/records approval changes this policy |
| Public                       | Deliberately public marketing copy, if later added                                          | Public web assets only after review                                                 |

The current product authorization permits real policy/reference content only. It
does not permit real incident, inmate, report, roster, or operational paperwork
data.

## Trust boundaries

Untrusted inputs include all browser requests, URL/search parameters, cookies,
headers, uploaded files, document text, retrieved policy passages, AI output,
queue messages, webhook payloads, environment names, and data copied from the
legacy repository.

Trusted components are trusted only within their narrow role:

- Vercel executes reviewed Next.js server code.
- Supabase Auth establishes an Auth identity; it does not by itself establish
  current application role, status, or record ownership.
- The server-only DAL enforces application authorization.
- PostgreSQL grants, constraints, and RLS enforce a second boundary.
- The worker is trusted only for its assigned job types and least-privileged
  database/Storage operations.
- AI provider output and policy corpus text are never trusted as instructions.

Neither a Client Component, hidden UI element, JWT user metadata field, queue
payload, signed URL, nor AI answer is an authority.

## Security invariants

### Identity and sessions

- No shared access code, default password, hard-coded credential, caller-chosen
  bootstrap secret, or credential in source control is permitted.
- Employee-number login must use the approved design in ADR-0003. Until its
  spike and security approval are complete, authentication is not production
  ready.
- Public signup, anonymous product access, unreviewed recovery, and direct Auth
  provider UI must be disabled.
- PIN-like secrets must meet the final approved entropy/length policy, reject
  employee-number equality and common/sequence values, and be stored only by the
  Auth provider as a salted password hash. A four-digit shared or reusable code
  is prohibited.
- Login responses do not reveal whether an employee number exists. Rate limits
  cover account, device, network, and global abuse dimensions.
- Pre-auth account resolution is server-only through a dedicated execute-only
  function/role; it must not use a browser-callable endpoint or the broad
  service role.
- Session tokens live only in Secure, HttpOnly, SameSite cookies managed on the
  server. Do not place tokens in localStorage or application logs.
- Session refresh, rotation, expiry, logout-all, disabled-account behavior, and
  credential-change revocation require integration tests.
- Administrative or destructive actions require a recent, purpose-bound step-up
  check. The step-up artifact is short-lived and single-use.

### Authorization and data access

- Every server mutation performs authentication, current account-status check,
  role/ownership authorization, input validation, and CSRF validation in that
  order before changing state.
- UI visibility is not authorization.
- Routine user requests must not use a credential that bypasses RLS.
- Application tables remain outside exposed schemas. Any exposed API schema
  contains only specifically reviewed functions or views and minimal grants.
- RLS is enabled and forced where applicable. Policies are operation-specific,
  default-deny, indexed, and tested for user, administrator, disabled account,
  missing identity, and cross-owner cases.
- JWT claims that can become stale or user-controlled are not the sole source of
  current role or account status. Sensitive operations consult authoritative
  application tables.
- Security-definer functions are exceptional, use an empty search_path, qualify
  every object, validate the caller, and have explicit execute grants.
- The Supabase secret/service credential never appears in browser code and is
  not the routine request credential.

### Records and history

- Revisioned incident, report, form, and paperwork history is append-only.
- Restore appends a new revision; it does not rewrite a prior revision.
- Mutations use optimistic concurrency and reject stale bases.
- Retryable mutations and job submissions are idempotent.
- AI or worker results are committed only if the referenced base revision is
  still current, unless explicitly stored as non-current recovery history.
- Unknown or absent source facts remain explicit gaps; they are not synthesized.

### AI and retrieval

- The browser never calls an AI provider directly and never receives provider
  credentials.
- Only the approved policy/reference corpus may contain real content.
  Operational prompts and evaluation fixtures remain fictional.
- Retrieved documents are untrusted data. Instructions inside a source document
  cannot change system policy, tool permissions, or output rules.
- Policy answers require verifiable source/version/page or section citations.
  Insufficient evidence returns an explicit limitation instead of an unsupported
  answer.
- Model, prompt, retrieval configuration, source versions, and embedding
  versions are recorded without logging restricted content.
- Provider adapters enforce timeouts, bounded retries, payload limits, and
  redacted errors.

### Storage and jobs

- All source, derived, template, and export buckets are private.
- Object access is authorized on every operation. Public bucket URLs are
  prohibited.
- Signed URLs are short-lived and treated as bearer credentials. Sensitive
  exports prefer an authenticated streaming route because a signed URL remains
  valid until expiry.
- Uploads are size/type bounded, content-addressed, quarantined until validated,
  and parsed outside interactive database transactions.
- Queue messages contain IDs, versions, action codes, and digests—not document
  text, credentials, prompts, or report content.
- Workers use narrow credentials, atomic claims/visibility windows, bounded
  retries, idempotent completion, dead-letter handling, and stale-result checks.

### Secrets, logging, and supply chain

- Secrets are environment-scoped, server-only, rotated, and absent from Git,
  build output, screenshots, telemetry, test snapshots, and error responses.
- Only variables intentionally safe for every browser user may use the
  NEXT_PUBLIC_ prefix.
- Audit events are append-only and contain identifiers/action metadata rather
  than content or credentials.
- Application logs are structured and redacted. Request IDs support correlation
  without exposing subject data.
- Dependencies and GitHub Actions are reviewed and pinned according to the
  repository's supply-chain policy before production.
- Preview deployments use fictional data and isolated Supabase resources. They
  never connect to production.

## Reportable findings and severity

Treat a finding as **critical** when a realistic untrusted path can:

- expose or modify the entire corpus, all accounts, all records, or all secrets;
- bypass authentication or gain administrator privileges;
- execute arbitrary server/database/worker code;
- use a browser-accessible service credential or RLS-bypass role.

Treat a finding as **high** when it can:

- read or modify another user's restricted rows or objects;
- bypass step-up for a high-impact admin action;
- persist fabricated AI content as reviewed fact without a user gate;
- rewrite immutable history or commit a stale job result;
- disclose policy corpus content outside authorized users.

Treat a finding as **medium** when it creates a bounded but meaningful control
failure such as account enumeration, missing CSRF on a state change, reusable
signed exports, sensitive metadata in logs, weak rate limiting, or queue replay
with constrained impact.

Severity must consider reachability, required role, affected data class,
environment, user interaction, and compensating controls. Tests demonstrate
intent but are not proof.

## Out of scope and accepted limitations

There are no blanket exclusions for generated code, dependencies, SQL, RLS,
infrastructure configuration, prompts, or test utilities.

These conditions are not vulnerabilities by themselves:

- the documented local foundation lacks later target features;
- a free development project may pause or have small quotas;
- fictional preview data is visible to authorized preview reviewers;
- an optional worker provider has not yet been selected.

They become reportable when code or documentation represents an unimplemented
control as active, an environment crosses its approved data boundary, or a limit
causes unsafe loss/corruption rather than a clear failure.

No security or compliance certification is asserted. Vendor agreements, data
residency, records retention, backup objectives, and production approval remain
owner decisions.

## Required security verification

Before production approval, evidence must cover:

- employee-login abuse, enumeration, lockout, password policy, refresh,
  revocation, disabled accounts, logout-all, and admin step-up;
- CSRF, origin checks, cookie attributes, CSP, no-store behavior, and safe
  redirects;
- grants and RLS matrices for every table/function/storage bucket;
- cross-owner and user-to-admin access denial;
- append-only audit/revision triggers, concurrency conflicts, and idempotency;
- upload validation, private-object access, signed-download expiry, and queue
  authorization;
- prompt injection, citation grounding, insufficient-evidence behavior, and
  stale AI result rejection;
- secret scanning, dependency review, backup restore, and environment isolation.

See [ARCHITECTURE.md](ARCHITECTURE.md) and
[docs/architecture/auth-rbac-rls.md](docs/architecture/auth-rbac-rls.md) for the
target design.
