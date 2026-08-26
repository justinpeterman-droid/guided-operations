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

| Method/path                     | Purpose                              | Special controls                                                          |
| ------------------------------- | ------------------------------------ | ------------------------------------------------------------------------- |
| POST /auth/login                | Employee number plus PIN-like login  | Pre-auth rate limits, generic failure, no CSRF requirement before session |
| GET /auth/session               | Current session/account summary      | No-store; current DB account check                                        |
| POST /auth/renew                | Server session refresh               | Rotation/revocation tests; no token body                                  |
| POST /auth/logout               | End current session                  | CSRF                                                                      |
| POST /account/change-credential | Replace temporary/current credential | CSRF, current secret or approved forced-change flow                       |
| GET /account/sessions           | List safe session/device metadata    | No tokens                                                                 |
| DELETE /account/sessions/{id}   | Revoke one session                   | CSRF, ownership                                                           |
| POST /account/logout-all        | Revoke all sessions                  | CSRF, auth-version increment                                              |

Whether renew is a visible route or fully handled by the supported Supabase SSR
proxy is an implementation detail; the observable contract must remain tested.

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

### Reports

- GET /incidents/{incidentId}/reports
- GET /reports/{reportId}
- PATCH /reports/{reportId}
- GET /reports/{reportId}/revisions
- GET /reports/{reportId}/revisions/{revisionNumber}
- POST /reports/{reportId}/restore
- POST /reports/{reportId}/export

An export always names an explicit immutable revision and template version.

### AI jobs

- POST /incidents/{incidentId}/jobs/{jobType}
- GET /jobs/{jobId}
- POST /jobs/{jobId}/cancel when cancellation semantics are implemented

Allowed job types are a closed enum. Submission contains the expected immutable
base revision, not free-form provider instructions. Status returns safe stages,
progress, result references, and error codes rather than provider payloads.

### Policy Expert

- POST /policy/questions
- GET /policy/sources/{sourceId}/citation?version=...&page=...

Question input is bounded and idempotent. Answers use a structured citation
schema. The citation endpoint returns only the authorized excerpt needed to
verify the answer.

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
