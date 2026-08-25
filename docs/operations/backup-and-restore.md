# Backup and restore

Database backups and Supabase Storage backups are separate controls. Supabase
database backups include Storage metadata but **not the stored objects**. A
recoverable release needs both.

## Scope

Back up and test recovery for:

- PostgreSQL application schemas, migrations and required Auth-linked records;
- private Supabase Storage buckets and object paths;
- approved policy/reference source documents;
- corpus manifest, checksums, source metadata, parser/chunker/embedding
  configuration and index version;
- non-secret environment/configuration inventory;
- release and migration records;
- custom domains and provider configuration needed to rebuild, without exporting
  secret values into documentation.

Do not back up generated previews, caches, build output, signed URLs, temporary
AI responses, or derived embeddings when they are reproducible from the approved
source corpus unless recovery objectives require them.

## Initial recovery objectives

Before operational use, the owner must approve recovery objectives. The
foundation target is:

- maximum 24-hour data-loss window (RPO) for production qualification data and
  corpus changes;
- restore service within 8 hours (RTO) after provider/project loss;
- a restore exercise at least quarterly and before the private hobby release,
  then again before any future official facility pilot;
- an additional verified backup before risky migrations, bulk corpus
  replacement, or provider retirement.

These are targets, not current capability. Free-plan pausing, manual exports,
operator availability, and short log retention may prevent them; that is a
launch blocker unless explicitly accepted or resolved.

## Database backup

### Free-plan baseline

1. Run a scheduled logical export using the current Supabase CLI `db dump`
   workflow from a protected runner/operator host.
2. Capture schema and data needed for recovery using commands validated against
   the current CLI version. Do not assume managed or internal schemas are
   included; verify Auth and migration-history coverage in the restore exercise.
3. Encrypt the archive before placing it in an off-provider backup location.
4. Record UTC time, source project alias/region, database version, migration
   head, tool version, archive checksum, encryption/key reference, size and
   retention date.
5. Restrict access and separate backup credentials from runtime credentials.
6. Verify archive readability and checksum after upload.

Supabase recommends regular logical exports for Free projects. Paid projects add
managed daily database backups; Point-in-Time Recovery is a separate upgrade.
Managed backup availability does not remove the need for Storage-object backup
or restore testing.

### Retention

Until an owner-approved records policy exists, use a conservative technical
schedule for non-operational qualification data:

- seven daily logical backups;
- four weekly backups;
- three monthly backups;
- pre-migration backups until the migration and next restore exercise are
  accepted.

Do not apply this retention to future operational records without
records-owner/legal approval.

## Supabase Storage backup

For every private bucket:

1. Export an inventory containing bucket, exact object key, version/corpus ID,
   byte size, MIME type, creation/update time and SHA-256 checksum.
2. Download each object through the Storage API using a dedicated server-side
   backup identity. Never make the bucket public and never write directly to the
   `storage` database schema.
3. Encrypt objects and inventory in an off-provider destination.
4. Compare object count, total bytes and checksums with the source.
5. Record missing, duplicate or unverifiable objects and fail the backup.

The policy corpus additionally retains an immutable manifest mapping each source
document to checksum, effective/version date, provenance, approval, extraction
status and derived index version. Embeddings and search indexes must be
reproducible from this manifest.

## Restore exercise

Restore into a new, isolated Supabase project in the approved US region. Never
test a restore over production.

1. Obtain owner authorization and create the disposable recovery project.
2. Apply repository migrations to establish expected structure, or follow the
   tested full-dump restore method when the backup includes schema.
3. Restore database data and verify migration history, row counts, foreign keys,
   constraints and audit continuity.
4. Restore private buckets through the Storage API, preserving approved object
   paths.
5. Compare every restored object against the backup manifest checksum.
6. Rebuild the RAG index from approved sources; verify corpus/version counts and
   retrieval/citation evaluations.
7. Configure test-only Auth redirect URLs and keys.
8. Run RLS, Storage, authentication, core workflow, AI, visual/print and export
   checks using fictional accounts.
9. Confirm no production URL, webhook, email, AI key or scheduled job points to
   the recovery project.
10. Record elapsed time, achieved RPO/RTO, failures and corrective actions;
    securely remove the disposable project only after evidence is retained and
    owner authorizes deletion.

## Production restoration

Production restoration is an incident operation:

- preserve the failed project and evidence when possible;
- restore into a replacement project rather than overwriting the only copy;
- rotate credentials and validate RLS before connection;
- rebuild a Vercel deployment with the replacement environment values;
- obtain owner approval before domain/traffic changes;
- keep the previous project isolated until reconciliation is complete.

## Failure conditions

A backup is not valid when:

- it exists only inside the source provider/project;
- it lacks encryption or a verified checksum;
- Storage objects or corpus originals are missing;
- Auth-linked state is assumed rather than tested;
- the decryption key is unavailable or stored beside the archive without
  independent control;
- no restore exercise has successfully used the artifact;
- real operational data appears in a non-production restore.

Reference:
[Supabase database backups](https://supabase.com/docs/guides/platform/backups),
which explicitly notes that database backups do not contain Storage objects.
