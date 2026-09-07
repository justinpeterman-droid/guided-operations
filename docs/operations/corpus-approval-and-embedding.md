# Corpus evidence inspection and embedding

`npm run corpus:inspect` reads source evidence and reports eligibility, existing
approval, and blockers. `--document-version <uuid>` narrows the selection. It
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

`npm run corpus:embed` calls the existing policy-ingestion CLI in dry-run mode
for each distinct already-approved version. `--limit <positive-integer>` bounds
the count. Applying requires `--apply --confirm-production-embedding`; the
existing CLI validates the approved production project and controlled
provider-egress requirements before processing. Shell interpolation is disabled.
Logs contain opaque version IDs and counts, never source text, personnel,
credentials, or raw provider errors. Persisted embeddings are skipped; an
interrupted provider request can incur costs before persistence.

Commands use explicitly supplied environment variables, not automatic
environment-file loading. Use the existing credential procedure. No production
command is part of automated recovery validation.

Run `npm run test:operations` for argument, evidence and redaction tests.
Database quality runs `npm run test:corpus:integration` on its fresh fictional
database. Local integration accepts only loopback test databases on ports 54322
or 57322. It tests actual read-only evidence queries; fixture writes are rolled
back and pending approval state is preserved.
