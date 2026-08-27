# API Contracts

**Status:** Target contract direction

## Boundary

The browser-facing API is a same-origin backend-for-frontend under /api/web/v1.
It is implemented with Next.js Route Handlers on the Node.js runtime. The old
bearer API built for Microsoft Access is not part of this private web-only
replacement.

Server Components may call the DAL directly. Client Components and external
browser requests use Route Handlers. Neither path bypasses the same domain and
authorization services.

## Contract source of truth

- The implemented `/api/web/v1` surface is specified in
  [openapi-web-v1.yaml](openapi-web-v1.yaml). Expand it in the same change as
  every implemented browser API endpoint.
- Generate or validate shared TypeScript request/response types from the
  reviewed schema; do not let implementation types silently define the wire
  contract.
- Contract tests exercise authentication, authorization, status codes, headers,
  idempotency, concurrency, pagination, error redaction, and content types.
- Additive compatible fields are optional. Breaking changes require a new API
  version or explicit coordinated migration.

## Common headers

| Header                         | Direction           | Rule                                                               |
| ------------------------------ | ------------------- | ------------------------------------------------------------------ |
| Content-Type: application/json | Request/response    | Required for JSON bodies                                           |
| X-CSRF-Token                   | Mutation request    | Must match the session-bound CSRF design                           |
| Idempotency-Key                | Retryable mutation  | Opaque bounded value; unique per actor/action intent               |
| If-Match                       | Revisioned mutation | Quoted current revision; must agree with body base_revision_number |
| X-Request-Id                   | Response            | Server-generated/validated safe correlation ID                     |
| Cache-Control                  | Response            | private, no-store for authenticated/sensitive responses            |

Do not accept identity, role, owner, facility, or authorization scope from a
client header.

## Response envelope

Successful JSON:

```json
{
  "data": {},
  "meta": {
    "request_id": "uuid",
    "api_version": "web-v1"
  }
}
```

Error JSON:

```json
{
  "error": {
    "code": "stable_machine_code",
    "message": "Safe user-facing message",
    "details": {}
  },
  "meta": {
    "request_id": "uuid",
    "api_version": "web-v1"
  }
}
```

Details are allowlisted and may include safe field names, retry timing, current
revision number, or validation codes. They do not include SQL, stack traces,
provider bodies, employee numbers, aliases, credentials, corpus passages,
prompts, answers, or record content.

## Endpoint groups

### Authentication and account

| Method/path                     | Purpose                                 | Special controls                                                          |
| ------------------------------- | --------------------------------------- | ------------------------------------------------------------------------- |
| POST /auth/sign-in              | Employee number plus PIN-like login     | Pre-auth rate limits, generic failure, no CSRF requirement before session |
| GET /auth/session               | Current session/account summary         | No-store; current DB account check                                        |
| POST /auth/renew                | Server session refresh                  | Rotation/revocation tests; no token body                                  |
| POST /auth/sign-out             | End current browser session             | Current-account, same-origin, and session-CSRF proof                      |
| POST /auth/sign-out-all         | Revoke this account's provider sessions | Current-account, same-origin, session-CSRF proof, no token body           |
| POST /account/change-credential | Replace temporary/current credential    | CSRF, current secret or approved forced-change flow                       |
| GET /account/sessions           | List safe session/device metadata       | No tokens                                                                 |
| DELETE /account/sessions/{id}   | Revoke one session                      | CSRF, ownership                                                           |
| POST /account/logout-all        | Revoke all sessions                     | CSRF, auth-version increment                                              |

Renewal is handled by the server-only encrypted-session proxy. It may rotate the
Supabase refresh token and rewrite only authenticated ciphertext cookies; no
token, alias, or provider user body is an observable API contract.

### Workspace and staff

- GET /home
- GET /home/system-status
- GET /staff with only the minimum display fields needed for ownership/preparer
  selection

Staff search never returns credential, internal alias, lookup digest, full Auth
metadata, or inactive accounts to ordinary users.

### Incidents

- POST /incidents
- GET /incidents
- GET /incidents/{incidentId}
- PATCH /incidents/{incidentId}
- GET /incidents/{incidentId}/revisions
- GET /incidents/{incidentId}/revisions/{revisionNumber}
- POST /incidents/{incidentId}/restore

Create/save/restore use idempotency. Save uses If-Match and
base_revision_number. Unauthorized records are concealed as not found.

The implemented `GET /api/web/v1/incidents` returns only a bounded,
authorization-filtered summary list: opaque incident ID, display identifiers,
status, category, occurrence/update timestamps, and current revision number. It
never returns field notes, reviewed facts, facility scope, or relationship
metadata. The current `api.list_incidents` RPC permits officers only their own
active incidents and permits active administrators facility-scoped summaries.

The first persistence primitive is the private-to-the-server
`api.create_incident` RPC. It receives the already validated create fields and
opaque request/idempotency digests, derives the actor from the request JWT, and
creates the incident plus immutable revision one in one transaction. It is not a
browser wire contract: the implemented `POST /api/web/v1/incidents` handler
first establishes current session authority, validates same-origin and
session-bound CSRF, accepts a closed body plus bounded `Idempotency-Key`, and
then invokes the RPC with the request-scoped JWT. It returns only an opaque
incident ID. Direct RPC calls still enforce active facility scope and payload
provenance. Hosted-session and browser-workflow integration remain separate
release gates.

The incident create contract also recognizes the recovered Report Assistant
checklist candidate by its versioned fact-field marker. In Development, Test,
and Preview, every candidate checklist answer must match one controlled
category, one known question, its answer type, dependency rule, and all
applicable blocking questions. Answered questions become note-backed confirmed
facts; Unknown and Not applicable remain explicit limited states. Production
rejects this candidate marker until the operational owner approves the exact
definition version. Removing the marker does not claim checklist completion.

The server-only `api.get_incident_revision` RPC is the corresponding narrow read
primitive for an immutable revision. It returns the incident identifiers,
revision identity/version, and reviewed facts—but never field notes, facility
scope, account identities, or relationship metadata. It returns no row for a
missing, archived, cross-facility, inactive, or unrelated-officer request;
active same-facility administrators may read a revision, as may its active
creator. It is not exposed as a browser endpoint yet. Its intended caller is a
server-side workflow that constructs a report-draft source from explicitly
selected confirmed facts only.

### Reports

- GET /incidents/{incidentId}/reports
- GET /reports/{reportId}
- PATCH /reports/{reportId}
- GET /reports/{reportId}/revisions

The implemented `POST /api/web/v1/report-drafts` is a versioned, private,
no-store boundary for generating a review-only candidate. It requires a current
account, same-origin request, session-bound CSRF proof, a closed JSON body, and
a bounded idempotency key. The body identifies an incident, immutable source
revision, report type, and explicit confirmed-fact IDs; it cannot choose an
actor, facility, or source text. The server authorizes the revision, validates
the provider output against those facts, and stores an immutable candidate
before returning only an opaque candidate ID. It is not a final-report endpoint
and it never returns generated narrative or source facts in the response.

`reportType` is a closed value: `first_person`, `supervisor_summary`,
`cover_letter`, or `disciplinary`. The same set is enforced at the request,
generation-source, candidate-read/write, report-read/list, and database-table
boundaries. A first-person candidate must contain first-person perspective; a
supervisor summary rejects first-person prose outside quotations. An unknown
report type fails closed instead of becoming an unreviewed new workflow.

The implemented `POST /api/web/v1/report-drafts/{candidateId}/finalize` is a
separate versioned, private, no-store boundary. It requires the same current
account, same-origin, session-CSRF, closed-JSON, and bounded-retry protections,
plus an explicit `reviewedByOfficer: true` attestation and a replacement
narrative supplied by the officer. It creates the first immutable report
revision with candidate provenance, marks the report `complete`, and returns
only an opaque report ID. It does not accept AI output as a final report and it
does not let a client choose the report actor, facility, or source revision.

The server-rendered `/reports/{reportId}` route uses the narrow `api.get_report`
RPC rather than a browser table query. It returns only the current immutable
revision to an active report collaborator or active same-facility administrator;
absent and unauthorized reports are concealed. The draft review screen retrieves
a fresh session CSRF token, requires an officer-reviewed attestation and
editable replacement narrative, then redirects only to the opaque report ID
returned by finalization.

The server-only `api.list_reports` RPC returns a bounded summary list—opaque
report ID, incident display identifiers, report type/status, current revision,
and update timestamp—only to an active report collaborator or active
same-facility administrator. It never returns report narrative, facts, facility
scope, or account relationship metadata.

The implemented `POST /api/web/v1/reports/{reportId}/revisions` is a private,
no-store correction boundary. It requires a current authorized account,
same-origin and session-CSRF validation, a closed bounded JSON body, and an
idempotency key. The caller must provide the revision number they reviewed; the
database locks the report and rejects a stale base revision with
`409 revision_conflict`. A successful request appends a new immutable revision
and returns only its revision number. It never updates, removes, or exposes an
earlier report revision.

The server-only `api.list_report_revisions` RPC returns a revision-history
timeline—revision number, correction reason, timestamp, current marker, and
restore provenance—to an active collaborator or active same-facility
administrator. It deliberately excludes report narrative from the history
summary. `api.restore_report_revision` is more restrictive: only the active
report owner may restore a prior revision. It requires the current base
revision, a bounded restoration reason, and idempotency data, then creates a new
immutable revision rather than changing the prior one. Administrative restore
remains unavailable until the required step-up workflow is implemented.

- GET /reports/{reportId}/revisions/{revisionNumber}
- POST /reports/{reportId}/restore
- POST /reports/{reportId}/export

An export always names an explicit immutable revision and template version.

Until deterministic server-side export is qualified, the implemented protected
report screen offers only an explicit browser print action for the current
immutable revision. `POST /api/web/v1/reports/{reportId}/print` requires the
current session, same-origin CSRF, a bounded retry key, and the exact current
complete revision. The database rechecks facility/report access, rejects stale
revisions, and records one idempotent `report.print.requested` event before the
browser opens its dialog. The audit holds only opaque references, revision,
action, request correlation, actor, and facility; it never holds narrative.
Print styling excludes navigation and mutation controls. The event records a
request, not completed physical/PDF output, and the server-side export endpoint
remains unimplemented rather than pretending browser print is a durable export.

### AI jobs

- POST /incidents/{incidentId}/jobs/{jobType}
- GET /jobs/{jobId}
- POST /jobs/{jobId}/cancel when cancellation semantics are implemented

Allowed job types are a closed enum. Submission contains the expected immutable
base revision, not free-form provider instructions. Status returns safe stages,
progress, result references, and error codes rather than provider payloads.

### Policy Expert

- POST /api/web/v1/policy-answer
- GET /api/web/v1/policy-sources/{documentVersionId}

The implemented answer endpoint is same-origin and session-CSRF protected even
though it has no durable mutation: this prevents cross-site use of the private
model/corpus allowance. It accepts a 3–2,000-character question, verifies the
current account, and may accept at most six 3–2,000-character prior user
questions as transient follow-up context. It does not accept prior answer text
from the browser. A likely follow-up may use the latest prior question to make
retrieval understandable, while generation treats every prior question as
untrusted context rather than policy evidence. The endpoint retrieves only
approved indexed passages for that account and returns either a
citation-validated answer or explicit insufficient evidence. It never retains
the question, prior questions, answer, passage, provider body, or storage key.
Provider/retrieval failures are a generic `503`.

The implemented PDF reader accepts only an opaque immutable document-version ID.
It first verifies the current account, then calls a session-bound database
function that rechecks facility, approval, rights-review dates, lifecycle,
current/superseded state, PDF metadata, and the exact content-addressed object
path. Only after that authorization does a narrow server-only Storage adapter,
bound to the same user's session, download the private object. Storage RLS
independently rechecks the same facility, rights, lifecycle, and object path at
download time. The server verifies byte size, MIME type, PDF signature, and
SHA-256 before returning an inline `application/pdf` response with
`private, no-store`, same-origin resource isolation, no-referrer, nosniff, and
sandbox headers. The browser receives neither a Storage credential nor a
signed/public URL, and routine reads never use the Supabase secret credential.
Denied or malformed source IDs are concealed as `404`, and Storage or integrity
failures are generic `503` responses. Operational events contain only
event/outcome/request/timing/deployment fields; they exclude source IDs, paths,
titles, URLs, and content. Page-targeted excerpt/highlight behavior and the
user-facing full-reader integration remain later implementation items.

### Forms, packets, and paperwork

- GET /forms and /forms/{templateId}
- GET /incidents/{incidentId}/packet
- POST /incidents/{incidentId}/packet/rebuild
- POST /incidents/{incidentId}/packet/additional
- PATCH /packet-items/{itemId}
- POST /packet-items/{itemId}/populate
- GET/PATCH /form-instances/{instanceId}
- POST/DELETE physical acknowledgment routes
- GET/POST/PATCH revisioned paperwork routes
- GET/POST print-template preview/action routes

The private Count Sheet read primitives are `api.list_count_sheets(date)` and
`api.get_count_sheet(record_id)`. `GET /api/web/v1/count-sheets?work_date=...`
uses them to return only the current account's assigned-shift sheet, or a blank
copy of the exact approved structure when no revision exists. An active officer
can receive only the sheet for their administrator-assigned shift; active
same-facility administrators can oversee all facility shifts through the private
primitives but the officer workspace still requires their own assigned shift.
Missing, inactive, cross-facility, unassigned, and malformed results fail
closed. Read responses are private and `no-store`.

`POST /api/web/v1/count-sheets` is the protected Count Sheet save boundary. It
requires a current session, same-origin request, session CSRF, closed JSON body,
a bounded idempotency key, and base revision number. The server validates the
exact reviewed structure and values; the database rejects any different form,
revalidates the closed shape, and derives totals. It creates revision one or
appends exactly the next immutable revision for the current officer's assigned
shift. A stale base revision returns `409 revision_conflict`; it never
overwrites newer work. The route does not accept a facility, account, or shift
from the browser.

`GET /api/web/v1/count-sheets/{recordId}/revisions` returns no more than the
latest 100 immutable revision summaries after current-session and database
authorization. Adding `revision_number` returns one exact saved snapshot only.
Both responses are private and `no-store`; stored structure, values, and totals
are revalidated before a historical snapshot reaches the browser.

`POST /api/web/v1/count-sheets/{recordId}/restore` requires same-origin CSRF, a
bounded retry key, the current base revision, the selected prior revision, and a
reason. Only an active account assigned to the record's facility and shift can
restore it. The database copies the prior immutable snapshot into a new revision
with source provenance. It never edits or replaces history, and a stale base
revision returns `409 revision_conflict`.

`POST /api/web/v1/count-sheets/{recordId}/print` is the deliberate protected
print-request boundary. It requires same-origin CSRF, a bounded retry key, and
the exact current saved revision. The database verifies the active account's
facility and assigned shift, rejects a stale revision, and writes one idempotent
`count_sheet.print.requested` audit event before the browser opens its print
dialog. The audit contains only the opaque record reference, revision number,
action, request correlation, actor, and facility; it never stores Count Sheet
values. The event records a request and does not falsely claim the user
completed a physical or PDF print.

Form population names the reviewed incident revision and template version.
Unknown values remain blank/gaps.

### Administration

- GET/POST/PATCH /admin/staff
- GET/POST/PATCH /admin/accounts
- POST account reset/unlock/revoke-sessions
- GET /admin/incidents and record detail
- POST record restore/transfer
- GET /admin/audit and protected export
- GET /admin/health and /admin/overview
- POST corpus document/version/activation operations

All admin routes check current database role. High-impact mutations require
purpose-bound step-up and idempotency. User callers receive concealed 404 where
route/resource discovery is sensitive.

## Mutation pipeline

1. Bound method, media type, body size, and parsing.
2. Verify session.
3. Verify same-origin and CSRF for state changes.
4. Validate the closed request schema.
5. Load current account status/role.
6. Authorize record/action.
7. Resolve/replay idempotency.
8. Enforce optimistic concurrency.
9. Execute one short domain transaction.
10. Append safe audit/outbox metadata.
11. Map to the response DTO and security headers.

Provider or Storage calls occur before/after the transaction through explicit
state machines, not while row locks are held.

## Pagination and filtering

- Use opaque signed/keyset cursors containing the complete stable sort key.
- Bound page sizes and filter count.
- Filter fields are a closed schema.
- Stable default ordering ends with id.
- Never use an unrestricted sort column or raw SQL fragment from the client.
- Admin search audit stores only safe filter field names/count, not searched
  names, employee numbers, or content.

## Upload/download contract

Uploads use reviewed media types, maximum sizes, checksums, and private object
IDs. Prefer a short-lived signed upload only after authorization, followed by a
server finalize request that verifies checksum/metadata. A client-reported type
or checksum is not trusted.

Downloads reauthorize on every request. Content-Disposition uses a sanitized,
server-generated filename. Restricted files are no-store and nosniff.

## Caching

- Authenticated user/record/admin/policy answers: no-store.
- Static application assets: content-hashed immutable cache.
- Public-safe template metadata may receive a short private cache only after a
  route-specific review.
- Never cache by URL alone when output depends on cookies, role, ownership, or
  corpus authorization.
