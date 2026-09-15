# Corpus evidence inspection and embedding

`npm run corpus:inspect` reads source evidence and reports eligibility, existing
QA approval, and blockers. `--document-version <uuid>` narrows the selection. It
does not approve pages or chunks, set reviewer identity, mark a version indexed,
or activate retrieval. Write/reviewer flags are rejected before a connection is
opened. Evidence is read in one repeatable-read, read-only transaction. Blocked
evidence produces exit status 1 even when other versions are eligible; an
eligible result is not approval.

The recovered bulk approval shortcut was deliberately excluded: it made content
retrievable before embedding and qualification completed and accepted a reviewer
UUID without authenticated approval proof. Corpus approval and activation must
follow the existing controlled corpus protocol with authenticated reviewer
authority, complete embedding and citation/refusal qualification, and atomic
activation. The authenticated operator QA ceremony below implements review only.
Candidate evaluation and searchable activation remain separate gates.

## Embedding eligibility is separate from activation

A version may pass embedding eligibility in either of two states:

- reviewed staging: `lifecycle_status = pending`, `indexed_at IS NULL`;
- existing accepted version: `lifecycle_status = active`,
  `indexed_at IS NOT NULL`.

Both paths still require the approved document and version approval timestamp,
current version, unexpired processing rights and external-AI permission, ready
QA-approved ingestion, matching source hash and collection, and active
QA-approved chunks with every physical page in their range approved. Here the
existing chunk `active` flag is QA eligibility inside the run; it does not make
a pending document version searchable. Mixed activation markers and all other
version lifecycle states fail closed. Count, batch selection, and the locked
pre-egress check use the same predicate.

The inspector reports review steps only. Its `already-approved` classification
means QA review is complete, not that embeddings, qualification, or activation
are complete. It does not inspect vector coverage or authenticate the recorded
reviewer. No inspection result is permission to change production state.

Embedding writes profile-bound vectors only. It never changes version lifecycle
or `indexed_at`. Search and full-reader authorization remain unchanged and
exclude pending versions, including versions with a complete vector set. No
schema migration or runtime retrieval relaxation is needed for this change.

`npm run corpus:embed` calls the existing policy-ingestion CLI in dry-run mode
for each distinct already-approved version. `--limit <positive-integer>` bounds
the number of document versions, not chunks. For a first batch selected by exact
version, use the underlying CLI below. Applying requires
`--apply --confirm-production-embedding`; the existing CLI validates the
approved production project and controlled provider-egress requirements before
processing. Shell interpolation is disabled. Logs contain opaque version IDs and
counts, never source text, personnel, credentials, or raw provider errors.
Persisted embeddings are skipped; an interrupted provider request can incur
costs before persistence.

Commands use explicitly supplied environment variables, not automatic
environment-file loading. Use the existing credential procedure. No production
command is part of automated recovery validation.

Run `npm run test:operations` for argument, evidence and redaction tests.
Database quality runs `npm run test:corpus:integration` on its fresh fictional
database. Local integration accepts only loopback test databases on ports 54322
or 57322. It tests actual read-only evidence queries; fixture writes are rolled
back and pending approval state is preserved.

Remote database connections require certificate verification and a trusted CA
supplied as `SUPABASE_DB_CA` PEM or the URL `sslrootcert` file. A supplied
`sslmode` must be `verify-full`. Missing trust fails before connecting. Only
local read-only inspection permits plaintext loopback; embedding rejects
loopback. The Python embedding connection also enforces `verify-full`, rather
than overriding the URL with encryption-only `require`. For the underlying CLI,
provide the trusted CA using libpq's `sslrootcert` URL option or its approved
root-certificate configuration; the Node-only `SUPABASE_DB_CA` PEM variable is
not forwarded to libpq. Missing or invalid certificate trust fails closed.

## First production batch after review

### Inspect one immutable version

Verify the production project and current code revision using the existing
credential procedure. Run
`npm run corpus:inspect -- --document-version <version-uuid>` in the authorized
operator environment. Keep source text, review packets, credentials, and
provider output out of Git and logs.

### Record authenticated review

Complete the controlled human page/extraction review and record authenticated
reviewer authority against that exact immutable source/run. Retain pending
version lifecycle and null `indexed_at`. Use the authenticated operator ceremony
below after its exact candidate and hosted migration are qualified. The
inspection and embedding tools cannot approve content. A caller-supplied
reviewer UUID or direct bulk SQL is not a substitute.

### Run a bounded first batch

Confirm the pinned embedding profile and the approved OpenAI project's
data-control settings. From `tools/policy-ingestion`, run this dry-run with the
real opaque version UUID substituted in the private operator shell:

```powershell
uv run guided-policy-ingest embed <version-uuid> --target-environment production --source-data controlled-policy --confirm-controlled-production-embedding --batch-size 16 --limit 16 --dry-run
```

The dry-run reports total eligible and existing chunks; it does not send text or
preview a separate limit-adjusted count. Only after those counts and the
reviewed scope match, remove `--dry-run` to process at most 16 missing chunks of
that exact version. Existing vectors for the profile are skipped.

### Verify and resume

Reinspect stored vector counts/profile, immutable source/run evidence, and
pending/null activation markers. A partial batch is not indexing completion or
permission to search. Resume the reviewed version until coverage is complete;
interrupted provider requests can be billed before persistence.

### Qualify before activation

Run the private citation/refusal and answer-correctness qualification against
the staged candidate using an approved evaluation path. Do not temporarily
activate production retrieval to make evaluation possible. The runtime RPCs
deliberately cannot search pending sources. If that private evaluation path or
authenticated atomic activation ceremony is missing, it remains a release
blocker. Activate only after complete coverage and accepted qualification.

The deferred failed import remains excluded. This change neither repairs nor
approves it, re-extracts the corpus, changes models, or sends production
content.

## Verification and recovery

The fictional Python integration regression runs real eligibility/lock queries,
simulates a stored vector, proves pending sources remain invisible to hybrid
search and the full reader, and checks an active positive control. Rights,
approval, QA, stale-version, and inconsistent-state negatives remain denied. Its
fixture is restricted to the loopback test database and rolled back. Run
`npm run test:policy-ingestion` with the existing local integration database
configuration, plus `npm run test:operations` and the web gate.

To withdraw this operator-tool change, stop embedding work and revert the code.
Keep staged versions pending and unindexed; retained vectors stay inaccessible
and can be reused after a reviewed fix. Do not delete source evidence or change
activation markers as part of code rollback. No hosted change or corpus
qualification is established by these tests.

## Authenticated operator QA ceremony

Implementation candidate: forward migration
`20260915120000_add_authenticated_policy_review.sql`, the private
`/api/admin/policy-review` endpoint, and `npm run corpus:review`. This is not
hosted acceptance or evidence that any real source has been reviewed. The
candidate includes the pending staging-eligibility and dependency fixes from PRs
#63 and #64; those prerequisites must be qualified on the final release commit
rather than inferred from their earlier checks.

The owner performs this in the approved isolated Production operator
environment. Do not run it in this coding workspace, CI, Preview, shared
non-production, or a recorded terminal. The existing corpus excludes the
deferred failed import; 235 is an inventory count, never a bulk-selection
instruction. NCU policies stay in scope. No embedding provider is contacted by
these review commands.

### Release and authority requirements

Before enabling the endpoint, qualify the forward migration and exact server
candidate, follow the existing production migration procedure (including backup,
dry-run and explicit release authority), and verify the isolated project/origin.
Set `POLICY_CORPUS_REVIEW_ENABLED=true` only for that approved Production
release. The endpoint returns 404 otherwise and in every non-production
environment. Provide the trusted database certificate as server-only
`SUPABASE_DB_CA`; its connection requires certificate validation and rejects
weaker sslmode settings. Do not disable TLS verification to make an operator
command work.

This initial ceremony is deliberately owner-only: the authenticated active
administrator must also be the exact source's recorded rights reviewer under
O-028, in the same facility. No new administrator gains migration authority by
role alone. Another QA reviewer requires a separately approved delegation
contract. The live provider session, authoritative auth version, active staff,
forced-passcode-change state, current source, unexpired rights and provider
permission are checked again under locks. O-013 administrator assurance and all
other existing real-data release requirements remain requirements; fresh
passcode confirmation is not a claim to close them.

### Prepare one exact source and run

Use opaque IDs from the existing private inspector/operator inventory; never
infer an ID from a filename. The command signs in through the normal guarded
employee login with hidden terminal input and uses session-bound CSRF. Cookies
stay only in process memory; passwords are never command-line arguments.

```powershell
npm run corpus:review -- prepare --origin https://<approved-production-host> --document-version <version-uuid> --ingestion-run <run-uuid> --output <private-review-json>
```

Preparation creates a new metadata-only file without overwriting existing work.
It contains the exact source/run identity, a registry-evidence digest, page and
chunk evidence fingerprints, physical page/ordinal mappings and text hashes for
matching the private extraction artifacts, and a unique review ID. Every review
decision starts false; preparation is neither human review nor approval. Keep
this file in the restricted operator directory with private permissions/Windows
ACLs. Do not paste it or content-bearing review artifacts into chat, Git, or
logs.

### Perform and record the human review

For this first implementation use a full review, not an unapproved sampling
threshold. In the authorized private source/extraction environment, compare the
original bytes and version metadata, every physical page, extraction warnings,
OCR/empty-page decisions, every chunk and its bounded page mapping. Verify the
extraction is faithful and resolve discrepancies before proceeding. Never change
canonical source text or stored hashes to fit a review.

Maintain a private review record containing source/run identity, the evidence
examined and the page/chunk decisions. After actually reviewing each item, set
that item's `reviewed` field to true in the metadata manifest. Set
`sourceReviewed` true only after source/version review. Put the SHA-256 of the
completed private review record in `reviewRecordSha256`. Preserve every other
field and the review ID. These are human attestations, not a machine-certified
judgment; a command that automatically sets all decisions true is prohibited.

### Approve for embedding

```powershell
npm run corpus:review -- approve --origin https://<approved-production-host> --manifest <private-review-json> --source <exact-original-source> --review-record <private-review-record> --confirm-reviewed-version
```

The operator verifies the source and private review-record file hashes locally;
neither file is uploaded. It requests a fresh passcode confirmation for this
specific submission. The server issues a purpose-bound, short-lived proof which
never leaves that request. The database consumes the proof, rechecks the exact
manifest against current source/page/chunk evidence, records the authenticated
reviewer, and writes the allowlisted audit receipt atomically. Missing/duplicate
items, stale hashes or warnings, rejected evidence, incomplete imports, multiple
live ingestion runs, revoked sessions, or wrong owners fail closed.

Success means **approved for embedding**. Version lifecycle remains `pending`
and `indexed_at` remains null. Existing search and reader RPCs are unchanged. No
vectors are generated and no source becomes searchable. The existing 16-chunk
dry-run/apply procedure above remains the next step only after the OpenAI
project/data-control evidence is verified.

### Recovery

A timeout is not proof of failure: re-inspect metadata first, then resubmit the
same completed manifest and review ID through a newly authenticated command. The
same exact review returns `already_approved` without a second receipt. Changed
evidence or a reused ID with different input conflicts. Every retry still needs
a fresh passcode proof; consumed proofs cannot be replayed.

To withdraw the feature, set `POLICY_CORPUS_REVIEW_ENABLED=false` and stop
operator review/embedding. Keep the forward migration and append-only receipts;
do not edit an applied migration, undo human review via bulk SQL, delete staged
vectors, or set searchable markers. Code rollback preserves pending versions and
cannot activate them. Fix source evidence only through the existing
new-run/review protocol. Evaluation against staged candidates and authenticated
atomic activation are still separate implementation/qualification gates.

### Candidate qualification status

The operator implementation is prepared locally; no real corpus was read,
approved, embedded or activated. Local formatting, lint, type checking,
application/operations tests, build, secret/logging checks and npm dependency
verification have been exercised. The new pgTAP suite is written but still
requires execution against the full Supabase migration chain in Database
quality. No local Docker/PostgreSQL runtime was available; local database
package setup was unavailable in this sandbox. A passing unit test is not a
passed SQL gate.

GitHub metadata on 2026-09-15 reports this repository as **public**, contrary to
the private-repository wording in AGENTS.md and O-001. Do not infer permission
to publish controlled artifacts from that visibility. The owner explicitly
authorized publishing the code-only candidate branch and opening a public draft
PR on 2026-09-15 after the visibility discrepancy was surfaced. Repository
visibility is not changed by this work. Production migration and release remain
separately authorized actions after qualification.
