# Storage and Background Jobs

**Status:** Target design

## Storage buckets

All buckets are private. The foundation migration currently defines only
`policy-sources` and `generated-exports`; quarantine, derived artifacts, and
template buckets are planned and require later migrations plus policy tests.

| Bucket             | Content                                                             | Typical writer                | Typical reader                             |
| ------------------ | ------------------------------------------------------------------- | ----------------------------- | ------------------------------------------ |
| policy-quarantine  | Newly uploaded source documents awaiting validation                 | Authorized admin upload flow  | Ingest worker only                         |
| policy-sources     | Validated immutable original corpus versions                        | Ingest promotion service      | Authorized citation/ingest services        |
| policy-derived     | Page text, OCR, thumbnails, or other reproducible derived artifacts | Ingest worker                 | Retrieval/admin diagnostics                |
| document-templates | Approved DOCX/PDF/form templates                                    | Protected operator/admin flow | Export worker/server                       |
| generated-exports  | Generated immutable report/form/archive bytes                       | Qualified server or worker    | Currently authorized officer/administrator |

Do not use a public bucket for convenience. Bucket-level limits restrict allowed
media types and maximum sizes. Object authorization is tied to database parent
records, not a guessable path.

## Object identity

Recommended key pattern:

```text
{classification}/{logical-parent-id}/{version-or-revision}/{sha256}/{safe-name}
```

The database stores:

- bucket and object key/ID;
- parent type/ID and immutable version/revision;
- SHA-256, byte size, media type, created_by, created_at;
- parser/template/generator version;
- lifecycle state, retention/expiry, and deletion marker where approved.

The server computes/verifies checksums. Client metadata is untrusted.
Content-addressed writes use create-only semantics so retries cannot overwrite
different bytes at the same identity.

## Upload flow

1. Authenticate and authorize the parent action.
2. Validate proposed file name, media type, expected size, and source metadata.
3. Create an upload intent and short-lived signed upload or stream through a
   bounded server route.
4. Upload to a quarantine prefix.
5. Finalize through the server, which verifies actual size, checksum, object
   path, and metadata.
6. Enqueue validation/ingest by ID.
7. Promote by immutable copy/reference only after validation.
8. Expire abandoned/quarantined objects under a reviewed lifecycle rule.

Never parse an upload in a database transaction or trust a browser-reported PDF
type. Zip/archive support requires explicit anti-zip-bomb, entry-count, path,
and expanded-size limits.

## Download flow

Every download rechecks:

- active session/account;
- role and parent ownership/access;
- requested immutable revision/version;
- object lifecycle state;
- allowed action and audit requirement.

For restricted exports, prefer an authenticated same-origin streaming route. If
a signed URL is used, make it single-purpose and very short-lived. Treat it as
an unrevocable bearer until expiry and do not log it or place it in referrer
paths.

The implemented policy-source path is
`GET /api/web/v1/policy-sources/{documentVersionId}`. It does not issue a signed
URL or expose browser Storage access. A session-bound database function first
authorizes one exact approved content-addressed object. A narrow server-only
reader uses that same user session, and Storage RLS independently rechecks the
facility, rights, lifecycle, and object path before download. The server then
rechecks PDF MIME type, byte count, signature, and SHA-256 before responding
with non-cacheable same-origin headers. Application browser code has no direct
Storage client or readable token; anonymous listing and every browser write
remain denied. Routine reads never use the Supabase secret credential.

## Authoritative job state

Supabase Queue messages are delivery signals. `app_private.ai_jobs` or a general
`app_private.jobs` row is authoritative.

State machine:

```text
queued -> claimed -> running -> succeeded
                      |  |
                      |  +-> retry_wait -> queued
                      +----> failed
queued/claimed/running -> cancelled (only when cancellation is safe)
```

Every transition has a closed reason code, timestamp, actor/worker ID, and
expected state/version guard. Provider bodies and source/result content do not
belong in state metadata.

## Transactional outbox

The request transaction inserts:

- the domain change or job row;
- an idempotency record;
- safe audit metadata;
- one outbox intent.

A dispatcher sends undispatched intents to pgmq and marks them dispatched using
an atomic/idempotent protocol. If queue publication fails, the committed outbox
remains retryable. Do not publish a queue message and then hope the database
commit succeeds.

## Queue contract

```json
{
  "schema_version": 1,
  "job_id": "uuid",
  "job_type": "closed-enum",
  "expected_target_version": 7,
  "correlation_id": "uuid",
  "enqueued_at": "timestamp"
}
```

No raw document text, prompt, answer, record content, credential, signed URL, or
provider key is permitted in a message.

Suggested logical queues:

- ai-jobs
- policy-ingestion
- embeddings
- document-exports

### Local policy extraction exception

The implemented MinerU policy extractor is a bounded local batch tool, not an
interactive Vercel job. It runs on the authorized Windows workstation so OCR has
no per-page cloud API charge and may use the local NVIDIA GPU. Source bytes and
normalized text never enter a queue message. The local checkpoint records only
private artifacts under the operator-selected working directory; database
commits are short, per-document imports performed after extraction and
validation finish.

Checkpoint identity is the source SHA-256 plus the extraction, normalization,
and chunking configuration hashes. A completed identity is skipped, an
interrupted attempt can resume, and a forced attempt creates a new numbered
directory. Safe database failure fields and batch reports contain collection,
hashes, counts, timing, and controlled error codes—not policy text, credentials,
or original absolute paths.

Start with fewer queues if visibility/retry requirements are identical. Split
only when isolation, concurrency, or alerting requires it.

## Claim, lease, and completion

1. Consumer reads with an appropriate visibility window.
2. It atomically changes queued/retry_wait to claimed, records a random claim
   digest, worker ID, attempt, and lease expiry.
3. It loads current target metadata and rejects stale/deleted/unauthorized work.
4. It performs external work outside a database transaction.
5. It uploads immutable result bytes first when needed.
6. It completes in a short transaction that checks job ID, claim, current state,
   expected target revision/version, and result checksum/reference.
7. It acknowledges/archives the queue message only after durable completion.

Lease renewal is bounded. Expired claims become retryable through a reconciler.
At-least-once delivery is assumed even if a provider advertises stronger
semantics; side effects remain idempotent.

## Retry and dead-letter policy

- Retry only classified transient failures.
- Use exponential backoff with jitter and a maximum attempt/age.
- Validation, authorization, unsupported media, stale base, and deterministic
  schema errors fail without blind retry.
- Rate limits honor provider retry guidance within a cap.
- Dead-letter metadata contains job IDs and safe reason codes, not payload
  content.
- Admin retry creates an audited new attempt and never edits historical outcome.
- Alerts cover oldest queued age, depth, lease expiry, repeat provider failures,
  dead-letter count, and completion latency.

## When Vercel is enough

A task may execute in Vercel only when staging evidence shows:

- worst-case duration remains comfortably below the current plan limit;
- memory, package, temporary filesystem, request/response, and concurrency fit;
- interruption/retry is safe and idempotent;
- no continuously polling process is required;
- user latency is acceptable or status is asynchronous;
- cost is bounded.

Simple database work, small validated exports, and short policy questions may
qualify.

## Worker activation criteria

Activate ADR-0005 if any required workload:

- needs a continuously available queue consumer;
- approaches Vercel duration/memory/package/temp limits;
- performs OCR or native/Python document processing not safely supported by the
  chosen Vercel runtime;
- creates large/bulk DOCX/PDF/ZIP artifacts;
- requires resumable embedding batches or long provider waits;
- needs process-level isolation from interactive traffic.

The worker is one deployable initially, not a microservice fleet. It must be
non-Google hosted in an approved US region. Provider selection, networking,
patching, secret delivery, logs, availability, and cost remain a separate
approval.

## Document generation

Preserve deterministic generation:

- exact source revision and template version;
- fixed metadata/timestamps where document format permits;
- canonical field ordering and safe filenames;
- same inputs produce the same checksum;
- unknown values remain blank/gaps;
- generated bytes are immutable and referenced by export metadata.

Port simple generation to TypeScript only if fidelity tests pass. Retaining
python-docx/lxml/PDF tooling in the optional worker is acceptable and does not
reintroduce Google hosting.

## Lifecycle, backup, and deletion

- Corpus source versions follow records-owner retention and legal-hold rules.
- Derived text/vectors may be regenerated only while original bytes,
  configuration, and provenance remain available.
- Controlled Production exports follow the approved two-year record rule;
  fictional Preview/local artifacts remain short-lived and contain no real data.
- Quarantine and abandoned upload intents expire quickly after review.
- Database backups do not include Storage bytes; back up objects and metadata
  separately and test cross-reconciliation.
- Deletion is a two-step authorized lifecycle operation with object/database
  reconciliation. No broad recursive delete is part of application code.
- A database eligibility date or released hold never grants Storage deletion
  authority. The job must recheck active holds and reconcile every included
  database row, object, export, and backup before an owner-approved cleanup.

## Required tests

- private bucket and cross-user denial;
- MIME/size/checksum/path validation and abandoned upload cleanup;
- signed/streamed download authorization and safe headers;
- outbox recovery after queue failure;
- duplicate delivery and duplicate completion;
- lease expiry/reclaim and stale base rejection;
- retry classification and dead-letter redaction;
- deterministic export checksum;
- database/Storage backup restore reconciliation;
- browser and queue clients cannot access unauthorized operations.
