# RAG Corpus Inventory and Migration Protocol

## Objective

Move the authorized policy corpus from the legacy Google-backed retrieval system
into a private, reproducible, provider-neutral system on Supabase, with enough
provenance to prove which source and page support every citation.

Target end state:

- original authorized source bytes in a private Supabase Storage bucket;
- a Supabase Postgres registry for source identity, version, rights, hashes,
  pages, chunks, ingestion runs, and citations;
- page-aware text extraction with OCR only when required;
- Postgres full-text and vector retrieval with measured indexes;
- server-only AI provider adapters; OpenAI may be the first provider;
- claim-level citations that resolve to stored passages and a full-policy
  reader;
- no runtime, storage, index, or generation dependency on Google Cloud;
- no corpus source files in Git by default.

This is a migration specification, not evidence that the corpus has been
migrated.

## Known legacy inventory

The canonical source snapshot is `justinpeterman-droid/prison-policy-ai` at
`ebe52c4b977ab742975974732beec42fff1bbce5`.

| Legacy evidence                                             | Verified baseline                                                                                            | What remains unknown                                                                                                               |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| `rag_uploaded_pdfs.txt`                                     | Git SHA-1 blob `b93bdc97c63d298d3d24a8a073872db726d38734`; 13,292 bytes; 292 unique non-comment `.pdf` names | Source bytes, storage object IDs, content SHA-256, versions, page counts, current/superseded status, rights, and ingestion success |
| `backend/webapp/static/NCU_Operational_Training_Manual.pdf` | Git SHA-1 blob `7beee956a05a39ba62de372b390cf991c3eff84f`; 148,032 bytes                                     | Whether it is current, authoritative, rights-approved, and identical to the indexed object                                         |
| Legacy ingestion/retrieval code                             | Google Discovery Engine/Agent Builder search/answer flow plus Gemini fallback                                | Complete indexed-object inventory, exact chunking/model versions, and reproducibility                                              |
| Legacy citations                                            | Source title/path and excerpt; inline marker parsing with lexical fallback                                   | Reliable page mapping and strict claim-to-passage verification                                                                     |
| Full-reader branch                                          | `feat/full-policy-reader` at `c5e49c809674750e6be36ae1b042222a6d2ce3cd`                                      | Not merged; Flask/Jinja/vanilla JS; no Next.js/Supabase port                                                                       |

The manifest is an inventory lead, not the corpus. Do not reconstruct a policy
from embeddings, search snippets, generated answers, or cached excerpts. If
authoritative source bytes cannot be recovered, mark that source **missing** and
block its migration.

## Roles and approvals

Assign named people before moving source bytes:

| Role                    | Responsibility                                                                                                 |
| ----------------------- | -------------------------------------------------------------------------------------------------------------- |
| Corpus owner            | Confirms intended scope, current/superseded status, and business acceptance.                                   |
| Source custodian        | Provides authoritative bytes and source metadata from the controlled system.                                   |
| Rights/privacy reviewer | Approves storage, processing, embedding, quotation, full display, AI-provider transfer, region, and retention. |
| Security owner          | Approves Supabase project/bucket/RLS, credentials, access logging, backup, and deletion controls.              |
| Ingestion owner         | Runs the reproducible pipeline, resolves failures, and signs the run manifest.                                 |
| Policy QA reviewer      | Checks page mapping, extraction/OCR, version identity, retrieval, and citations.                               |
| Release owner           | Authorizes application cutover from legacy retrieval.                                                          |
| Retirement owner        | Authorizes irreversible deletion of Google resources after rollback gates close.                               |

No one person's application administrator role implicitly grants these migration
authorities.

## Rights decision per source

Record a rights decision before uploading or sending a source to an AI provider.
Required fields:

- source authority/owner;
- how the organization obtained the source;
- classification and sensitivity;
- permission to store in Supabase;
- permission to extract/OCR;
- permission to embed/search;
- permission to send source text to the selected embedding provider;
- permission to send retrieved excerpts to the selected generation provider;
- permission to quote excerpts to authenticated employees;
- permission to display/download the full source;
- allowed region(s) and subprocessors;
- retention, supersession, legal-hold, and deletion requirements;
- reviewer, decision timestamp, evidence reference, and expiry/review date.

Use a controlled status:

- `pending` — not usable;
- `approved_internal_search` — retrieval permitted but full display/export may
  be restricted;
- `approved_full_reader` — retrieval and authorized full-source display
  permitted;
- `restricted_provider` — may not be sent to the configured external AI
  provider;
- `quarantined` — integrity, malware, classification, or version concern;
- `rejected` — do not ingest or retain in the target;
- `expired_review` — remove from active retrieval pending renewed review.

Rights evidence and full source inventories belong in a controlled system, not
necessarily Git. Git may contain the schema, procedure, and redacted aggregate
status.

## Target corpus registry

The names below define required concepts; migration SQL may refine them while
preserving the contract.

### `policy_sources`

One immutable source-version record per acquired byte stream.

| Field                                                                                                      | Purpose                                                                                                    |
| ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `id`                                                                                                       | Internal `bigint identity` primary key for efficient joins.                                                |
| `policy_id`                                                                                                | Opaque, non-sequential public identifier; unique and never derived from a filename/path.                   |
| `family_id`                                                                                                | Stable opaque identity connecting revisions of the same policy/manual.                                     |
| `display_title`                                                                                            | Reviewed user-facing title.                                                                                |
| `source_filename`                                                                                          | Original filename retained as restricted metadata, never used as a URL authorization key.                  |
| `authority`, `policy_number`                                                                               | Reviewed issuing body and policy/manual identifier when available.                                         |
| `revision_label`, `effective_date`, `supersedes_source_id`                                                 | Version chain; nullable only with explicit unknown state.                                                  |
| `source_sha256`                                                                                            | SHA-256 of exact original bytes, unique within the approved corpus as appropriate.                         |
| `byte_size`, `mime_type`, `page_count`                                                                     | Verified technical metadata.                                                                               |
| `storage_bucket`, `storage_object_key`                                                                     | Private content-addressed object reference; restricted to server/ingestion roles.                          |
| `rights_status`, `rights_evidence_ref`, `rights_reviewed_by`, `rights_reviewed_at`, `rights_review_due_at` | Use authorization.                                                                                         |
| `classification`, `allowed_processing_regions`, `external_ai_allowed`                                      | Processing boundary.                                                                                       |
| `lifecycle_status`                                                                                         | `pending`, `active`, `superseded`, `quarantined`, `missing`, `rejected`, or `retired`.                     |
| `is_current`                                                                                               | Reviewed current-source flag; enforce at most one current revision per family when the domain requires it. |
| `created_at`, `created_by`                                                                                 | Registry provenance.                                                                                       |

Use `timestamptz`, explicit check/unique/foreign-key constraints, and indexes
for family/current, lifecycle/rights, hash, and RLS filters. Every foreign key
needs a supporting index. Do not use arbitrary `varchar(n)` limits in place of
domain checks.

### `policy_ingestion_runs`

One immutable run header:

- run ID and environment;
- source ID and source SHA-256;
- extraction tool/version and configuration hash;
- OCR engine/version/language/configuration hash;
- normalization/chunking version;
- embedding provider/model/version/dimension;
- code commit and dependency-lock hash;
- start/end timestamps;
- page/chunk counts, warnings, failures, QA state, reviewer;
- status: queued, extracting, awaiting_review, embedding, ready, failed,
  quarantined, superseded.

A retry creates an attempt record or new run identity. Do not overwrite
failed-run evidence.

### `policy_pages`

One record per physical PDF page/source page:

- source ID and ingestion run ID;
- `source_page_index` (1-based PDF page position);
- `printed_page_label` when the source displays a different label;
- extracted normalized text and SHA-256;
- extraction mode (`native`, `ocr`, `mixed`, `empty_expected`);
- OCR confidence/quality flags;
- page width/height/rotation;
- text spans/bounding boxes or a reference to structured layout data when
  available;
- rendered-page image hash for QA when page images are generated temporarily;
- warning/review status.

Unique constraint: `(ingestion_run_id, source_page_index)`. Never have an
untracked page-number offset hidden in application code.

### `policy_chunks`

One retrieval unit:

- stable opaque chunk ID;
- source ID, ingestion run ID, ordinal;
- start/end source page index and printed labels;
- section heading/path where deterministically available;
- normalized chunk text and SHA-256;
- start/end character or span references into page text;
- overlap and token-count metadata;
- lifecycle/QA status;
- generated full-text search document/fields.

Unique constraints bind the chunk to run/ordinal and text hash. A chunk must map
to existing page records and cannot span an unbounded number of pages.

### `policy_chunk_embeddings`

Keep embeddings separate from canonical chunk text so provider/model changes do
not mutate source evidence.

- chunk ID;
- embedding model registry ID;
- vector with the approved dimension;
- vector/content hash where practical;
- embedded-at timestamp and run/attempt;
- state and error code.

Unique constraint: `(chunk_id, embedding_model_id)`. Create the vector index
only after measuring corpus size, recall, latency, and supported pgvector
operator; record its parameters. Keep full-text indexes for exact policy
numbers, headings, and terminology.

### Citation/evaluation records

User question/answer bodies are transient by default. Durable evaluation
fixtures use fictional or approved non-sensitive questions. Where operational
metadata is required, store only:

- request correlation/hashed deduplication token;
- actor/account and authorized facility scope;
- retrieval/answer provider-model versions;
- source/chunk opaque IDs and scores;
- citation-validation outcome and safe failure code;
- latency/token/cost metadata that contains no prompt/excerpt;
- timestamps and environment.

Do not store the question, answer, prompt, or excerpt in ordinary
audit/analytics without a separate approved retention decision.

## Private object storage

Use a private Supabase Storage bucket such as `policy-sources`; the final name
is configuration, not a public contract.

Recommended object key:

```text
<opaque-policy-id>/<source-sha256-lowercase>.pdf
```

Rules:

- No public bucket and no predictable filename-only key.
- Never overwrite an object at an existing content-addressed key.
- Compute SHA-256 before upload and after download; byte size must also match.
- Store original bytes, not a re-saved PDF, as the authoritative source object.
- Derived text/layout artifacts have separate content-addressed keys or database
  rows and hashes.
- Browser access is issued only after current authorization, through a
  short-lived signed response/URL with restrictive caching and content
  disposition.
- Storage policies deny listing and cross-source access to ordinary browser
  users.
- Ingestion and server roles receive the minimum bucket/object permissions
  required.
- Malware/file-format scanning occurs before the object becomes active.
- Backups/restores preserve registry-to-object hash integrity.

## Acquisition and inventory protocol

Use the fail-closed
[private corpus manifest verifier](private-corpus-manifest-verification.md) to
bind the custodian-reviewed inventory to the exact original PDF bytes while
keeping all source metadata and content outside Git and non-Production systems.
Its value-free evidence is one input to R1 acceptance, not a substitute for
custodian approval, hosted Storage qualification, retrieval evaluation, or
restore proof.

### 1. Freeze a legacy export manifest

From the currently authorized Google-side source/index location, export a
controlled inventory containing at least:

- provider object/document ID;
- source object location;
- filename and available title/policy metadata;
- byte size, MIME type, created/updated time;
- current ingestion/index status;
- legacy datastore/index identifier;
- legacy checksum if available;
- current/superseded indicator if known.

Store the export outside Git in an owner-approved restricted location. Compute a
SHA-256 for the export and record the hash, row count, export time,
tool/version, operator, and access-control evidence in the migration run.

### 2. Reconcile to the 292-name Git manifest

Normalize only for comparison; preserve original values. Produce four sets:

- exact match;
- likely match requiring human confirmation;
- manifest name with no recoverable source object;
- provider source object absent from the Git manifest.

Do not merge duplicates based only on case-insensitive filename. Compare
authoritative bytes, source authority, policy number, revision, and dates.

### 3. Acquire authoritative bytes

Download each authorized object through the source custodian's controlled
export. For every object:

1. stream-compute SHA-256 and byte size;
2. detect actual file type and reject extension/MIME mismatch;
3. scan for malware and malformed/encrypted content;
4. extract page count without modifying the original;
5. compare legacy checksum/size when available;
6. assign an opaque policy ID and tentative family/version relationship;
7. place in quarantine storage;
8. record chain of custody: source, operator/job, time, hash, result.

Never use the old manifest alone to locate a path on disk, and never expose
provider storage paths to application users.

### 4. Complete rights and version review

The source stays quarantined until the source custodian and rights reviewer
resolve title, authority, version, current status, processing permissions, and
full-reader permission. Duplicate byte streams may share storage while retaining
necessary provenance records, but source/version decisions remain explicit.

## Extraction and page mapping protocol

### Deterministic extraction

1. Parse native PDF text page by page.
2. Detect empty, image-only, corrupted, rotated, low-text, or implausible pages.
3. OCR only pages needing it, using a pinned engine/language/configuration.
4. Preserve page boundaries before normalization.
5. Normalize line endings, Unicode, whitespace, hyphenation, headers/footers,
   and column order using a versioned algorithm; never discard original bytes or
   raw extraction evidence needed to reproduce mapping.
6. Record both 1-based PDF page index and visible printed page label when
   available.
7. Compute SHA-256 for normalized page text and every structured layout
   artifact.
8. Store warnings instead of silently dropping an unreadable page.

### Page QA

Automated checks for every source:

- parser page count equals registry page count;
- page records are contiguous from 1 to page count;
- every non-exempt page has text or a recorded extraction warning;
- no chunk references a missing page;
- extracted text and rendered-page hashes are stable on a reproducibility rerun;
- policy number/title/effective/revision metadata do not conflict with reviewed
  registry data;
- no extraction output contains local paths, credentials, or unrelated document
  bytes.

Human review is risk-based but mandatory. Review all
title/version/effective-date pages, all extraction warnings, all low-confidence
OCR pages, all pages used by the critical evaluation set, and a documented
sample across normal pages. The corpus owner and security/policy QA owners must
approve the sampling threshold before production; failure expands the sample or
quarantines the source.

### Chunking

Chunk by semantic section where reliable, with bounded token size and measured
overlap. Preserve exact character/span mapping back to page text. A
deterministic chunk identity can be derived from:

```text
SHA-256(source_sha256 + extraction_version + chunking_version + ordinal + chunk_text_sha256)
```

Do not use a model-generated heading or summary as source truth. Store it
separately as derived metadata if used.

## Embedding and retrieval

### Provider boundary

Implement server-only interfaces equivalent to:

```text
EmbeddingProvider.embed(texts, modelConfig) -> vectors + provider metadata
AnswerProvider.answer(question, authorizedPassages, modelConfig) -> structured claims + citation references
```

Domain code validates all returned dimensions, IDs, limits, structured fields,
and provenance. Provider request/response bodies are not ordinary logs.

OpenAI may be the initial provider only when rights review permits sending the
relevant text and the approved account/region/data-control settings are in
place. A source marked `external_ai_allowed = false` must never enter an
external provider request; either use an approved alternative or exclude it from
that capability.

### Retrieval sequence

1. Verify session, account state, role, facility/source access, and abuse/rate
   limits.
2. Validate a bounded question (length, encoding, prohibited payload classes).
3. Determine the allowed source/version filter before retrieval.
4. Run lexical search for exact policy numbers/terms and vector search for
   semantic similarity.
5. Combine/rerank through a versioned deterministic policy; filter
   inactive/quarantined/superseded sources unless explicitly requested and
   allowed.
6. Deduplicate overlapping chunks while preserving enough neighboring context.
7. Enforce passage/token/source-count limits.
8. Pass only the authorized selected passages to the answer provider.
9. Require structured claims that refer to supplied chunk IDs.
10. Validate every referenced chunk and supporting excerpt against stored
    text/page mapping.
11. Drop unsupported claims or fail the entire answer according to the approved
    strictness policy; never manufacture a citation.
12. Return answer, citations, source metadata, limitations, and a correlation ID
    without exposing storage keys/provider internals.

The old lexical-overlap citation fallback may inform tests but is not accepted
as authoritative claim support. Similar words do not prove that a passage
supports a claim.

### Citation response contract

Each user-visible citation should resolve to:

- opaque policy ID and source-version ID;
- reviewed display title, authority, policy number, revision/effective date when
  available;
- source SHA-256/version fingerprint (usually shortened for display, full value
  available to authorized diagnostics);
- chunk ID;
- 1-based PDF page start/end and printed page label(s) where available;
- exact normalized supporting excerpt and excerpt SHA-256;
- answer claim/span reference;
- reader URL using the opaque policy ID and a bounded highlight anchor;
- citation-validation version/result.

The server verifies that the excerpt belongs to the chunk and pages. The client
never supplies authoritative citation metadata.

## Full Policy Reader

Required behavior adapted from the branch-only design:

- Open from a citation or authorized policy catalog using opaque IDs.
- Display reviewed title/version/current status and a superseded warning when
  relevant.
- Prefer page-addressable text with citation highlight; offer an authorized PDF
  view/fallback when rights allow.
- Preserve question-page focus and scroll position when the user returns.
- Support keyboard navigation, zoom/reflow for text view, screen-reader
  headings/landmarks, and a non-color-only highlight.
- Do not accept arbitrary filenames, storage paths, bucket keys, URLs, or
  filesystem traversal input.
- Do not place a source document in `public/` or a permanent public CDN URL.
- Use restrictive cache headers appropriate to source classification and revoke
  access when the source/account becomes inactive.
- Log a bounded source-view action only if required; never log full
  excerpt/query content.

If rights permit retrieval but not full display, the reader explains the
restriction and shows only the approved cited excerpt.

## Evaluation and acceptance

Create a versioned evaluation set using fictional or approved non-sensitive
questions. Include:

- exact policy-number lookup;
- terminology and synonym queries;
- questions answered on one page and across adjacent pages;
- current vs. superseded source conflicts;
- no-answer/out-of-corpus questions;
- ambiguous questions requiring clarification;
- OCR-heavy sources;
- prompt-injection text inside a source document;
- citation tampering and nonexistent chunk/page IDs;
- unauthorized source/account cases;
- provider timeout, partial result, rate limit, and invalid structured output.

Measure and retain redacted aggregate results for:

- source recall at K;
- supporting-passage recall at K;
- answer groundedness/unsupported-claim rate;
- citation precision and page accuracy;
- no-answer correctness;
- current-version selection;
- median and p95 latency;
- provider/token cost per approved workload;
- retrieval availability and failure-mode clarity.

Before cutover, policy QA manually validates every critical evaluation case and
a documented corpus sample. Acceptance thresholds must be approved before
looking at final results. Do not tune the evaluation set until it merely passes.

## Reingestion and source lifecycle

- A new source byte hash creates a new immutable source-version record.
- Superseding a source updates the reviewed family/current relationship; it does
  not delete prior citations or rewrite old hashes.
- A new extraction/chunking/embedding version creates a new ingestion run and
  derived rows.
- Build the new run alongside the active run, evaluate it, then atomically
  switch the active retrieval configuration.
- Rollback selects the prior accepted run; it never reconstructs prior rows from
  model output.
- Quarantine immediately removes a source/run from new retrieval and reader
  access while preserving restricted evidence according to retention/legal-hold
  rules.
- Deletion requires rights/retention approval, verified backups/holds, object
  plus derived-row deletion plan, and an audit record that does not contain
  source content.

## Backup and restore

At minimum, prove:

- database backup covers registry, rights decisions/references, pages, chunks,
  embeddings or a reproducible path to rebuild embeddings, evaluation
  configuration, and active-run pointers;
- object backup covers every active original source hash;
- backup location satisfies the non-Google target and region/rights constraints;
- encryption keys and service credentials can be restored by authorized owners;
- a clean restore can recreate registry-to-object hash integrity and a working
  reader/retrieval environment;
- restore evidence records source count, object count, byte/hash reconciliation,
  run count, and evaluation result;
- recovery time and recovery point objectives are explicitly approved before
  real operational launch.

Free-plan backups, inactivity pausing, database size, object egress, function
duration, and vector/index limits must be verified rather than assumed.
Development may use free tiers; production corpus protection must meet the
approved recovery requirements.

## Git and artifact policy

Do not commit:

- source PDFs or extracted full text;
- page images, OCR output, embeddings, vector dumps, provider export files, or
  database dumps;
- filenames/object paths when the metadata itself is restricted;
- rights evidence containing contracts, identities, or sensitive links;
- questions, answers, full excerpts, prompts, evaluation traces, signed URLs, or
  credentials.

Git should contain:

- ingestion code and locked dependencies;
- schemas/migrations and RLS/storage-policy definitions;
- versioned normalization/chunking rules;
- fictional/non-sensitive test fixtures;
- redacted inventory counts and immutable manifest/export hashes;
- evaluation definitions that contain no protected content;
- runbooks and acceptance templates.

If a source file must ever be committed, require a documented exception covering
rights, sensitivity, repository access, history permanence, scanning, file size,
and revocation limitations. Private Git is still not a corpus access-control
system.

## Migration stages and gates

The repository now contains the local-only R2 registry foundation in forward
migration `20260826222000_add_policy_ingestion_provenance.sql`. It records
rights/current-version decisions, immutable ingestion identity, page evidence,
bounded chunk-to-page mappings, and ready-run QA/count checks. Retrieval now
excludes non-current, rights-expired, provider-disallowed, non-ready, or
non-approved page/chunk evidence. This is schema and fictional-test evidence
only: no hosted migration, real source upload, rights decision, extraction,
corpus acceptance, or production cutover has occurred.

| Stage                      | Work                                                                                        | Exit gate                                                                                                        |
| -------------------------- | ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| R0 — Discovery             | Export legacy provider inventory; reconcile 292 names; identify source bytes and owners     | Every entry is matched, missing, extra, or explicitly unresolved; export SHA-256 and custodian sign-off recorded |
| R1 — Rights and quarantine | Acquire bytes, hash/scan, assign opaque IDs, complete rights/version review                 | No active source lacks byte SHA-256, rights status, classification, and source/version decision                  |
| R2 — Registry and storage  | Apply reviewed schema/RLS/indexes; upload content-addressed private objects                 | Direct unauthenticated/wrong-role listing/read denied; object/hash reconciliation passes                         |
| R3 — Extraction            | Page extraction/OCR, metadata and page mapping, reproducibility run                         | Page counts contiguous; warnings reviewed; hashes stable; QA sample accepted                                     |
| R4 — Chunking/embedding    | Create versioned chunks and provider-approved embeddings                                    | All chunks map to pages; dimensions/counts/hashes valid; failed sources quarantined                              |
| R5 — Retrieval/citations   | Hybrid retrieval, answer adapter, strict citation verifier, full reader                     | Approved evaluation thresholds and authorization/tampering tests pass                                            |
| R6 — Shadow comparison     | Run old and new systems on approved non-sensitive regression set                            | Differences reviewed; new system meets grounding/page/current-source/error-state contract                        |
| R7 — Application cutover   | Route Policy Expert and reader to accepted Supabase run                                     | Production-candidate smoke, monitoring, rollback switch, owners, and traffic evidence pass                       |
| R8 — Google retirement     | Export/verify remaining evidence; close rollback window; delete ordered Google dependencies | Zero Google runtime/storage/index dependency and signed destructive-action record                                |

## Migration blockers

Do not cut over or retire Google retrieval while any of these remain unresolved:

- authoritative bytes for a required source are missing;
- source hash or byte count does not reconcile;
- rights to Supabase/OpenAI/other selected processing are unknown;
- current vs. superseded source status is unknown for a conflicting family;
- extraction drops pages or page mappings are unverified;
- citations cannot be revalidated against stored text and pages;
- reader source access can be bypassed or enumerated;
- no tested backup/restore exists outside Google Cloud;
- the application has no tested switch back to the last accepted retrieval
  configuration;
- the retirement owner has not explicitly approved irreversible deletion.
