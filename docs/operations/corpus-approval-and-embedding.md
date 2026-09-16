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
activation. This PR does not introduce that workflow.

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
version lifecycle and null `indexed_at`. The inspection and embedding tools do
not provide the approval mutation ceremony; if no reviewed authenticated path is
available, stop here and implement/qualify it. A caller-supplied reviewer UUID
or direct bulk SQL is not a substitute.

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
