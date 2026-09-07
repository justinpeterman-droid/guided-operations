# Corpus approval and embedding tools

Both commands default to a read-only preview and require explicitly supplied
environment variables. They do not automatically load an environment file. Use
the existing controlled production credential procedure; never paste credentials
into command arguments or logs.

`npm run corpus:approve` checks evidence without changing review state.
`--document-version <uuid>` narrows the selection. Applying requires
`--apply --confirm-production-corpus-approval --reviewer-id <staff-uuid>`. The
reviewer must be an active administrator linked to active staff in the selected
facility, with no required passcode reset. This is a privileged operator tool,
not an alternate public review API.

Approval rechecks source hashes, page and chunk counts, current version, rights,
lifecycle, and QA evidence inside a single transaction. Rejected pages or
blocked chunks prevent approval. Table locks serialize changes to that evidence
and reviewer authority; ordinary reads continue. Lock acquisition times out
after five seconds and individual statements after sixty seconds. A failed
transaction rolls back all its approvals. Logs use opaque identifiers and
counts, never reviewer names, employee hints, source text, or raw database
errors.

`npm run corpus:embed` calls the existing policy-ingestion CLI in dry-run mode
for each distinct approved version. `--limit <positive-integer>` bounds the
version count. Applying requires `--apply --confirm-production-embedding`; this
sends eligible policy text to the configured provider under the existing CLI
data-control guards. The Python tool must already be configured according to its
controlled policy runbook. Shell interpolation is disabled. The wrapper reports
malformed or failed subprocess results without exposing provider output.
Existing persisted embeddings are skipped; an interrupted provider request can
incur costs before persistence.

Neither tool replaces human source review, provenance verification, provider
approval, or the release procedure. No production operation is part of the
automated tests.

Run `npm run test:operations` for argument, evidence, and redaction tests. The
Database quality workflow runs `npm run test:corpus:integration` against its
freshly reset fictional database. Locally, set `CORPUS_TOOLS_TEST_DATABASE_URL`
only to the isolated loopback test database (ports 54322 or 57322). Its
fictional fixtures and approval changes are rolled back. It verifies approval,
idempotency, reviewer rejection, and exclusion of a concurrent evidence writer.
