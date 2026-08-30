# Environments and Delivery

- **Status:** Target design
- **Region assumption:** United States; exact paired regions require validation

## Isolation model

| Environment | Vercel                                     | Supabase                                                     | Data                                                                                         | Purpose                                     |
| ----------- | ------------------------------------------ | ------------------------------------------------------------ | -------------------------------------------------------------------------------------------- | ------------------------------------------- |
| Local       | Local Next.js/Supabase CLI where practical | Local stack or explicitly named disposable project           | Fictional fixtures; approved local corpus samples only                                       | Development and migration/RLS tests         |
| Test/CI     | Ephemeral process/services                 | Ephemeral local PostgreSQL/Supabase-compatible test services | Deterministic fictional fixtures                                                             | Unit, integration, contract, security tests |
| Preview     | Per-pull-request protected deployment      | Isolated preview/disposable project; never production        | Fictional only; synthetic corpus fixtures                                                    | UI and acceptance review                    |
| Staging     | Protected Vercel project/environment       | Dedicated staging project                                    | Fictional operational data; approved real corpus only if access controls are qualified       | End-to-end release qualification            |
| Production  | Protected production deployment            | Dedicated production project                                 | Owner-authorized real operational/personal data only after release gates; two-year retention | Approved live service                       |

A private GitHub repository does not make a Vercel preview private. Deployment
protection and application authentication must both be configured and verified.

## Region selection

- Select a Supabase US region first.
- Configure Vercel functions in the closest appropriate US region.
- Record measured database latency from staging.
- Keep the optional worker and AI data processing in approved US regions where
  provider configuration supports it.
- Do not infer contractual data residency solely from a dashboard region label;
  review current provider terms and subprocessors before production.

## Configuration classes

| Class                      | Examples                                                                                               | Storage                                                                 |
| -------------------------- | ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------- |
| Public build configuration | Product name, safe feature presentation                                                                | Reviewed source or NEXT_PUBLIC_ only when safe for every visitor        |
| Server configuration       | Supabase URL, model names, timeouts, queue names, feature gates                                        | Environment-scoped Vercel settings                                      |
| Secrets                    | Supabase secret/admin key, direct migration URL, OpenAI key, worker credentials, signing/pepper values | Protected provider secrets; never NEXT_PUBLIC_, Git, logs, or artifacts |
| Database configuration     | Roles, grants, RLS, extensions, queue definitions, bucket policies                                     | Forward-only SQL migrations                                             |
| Operator-only material     | First-admin request, recovery material, backup credentials                                             | Separate protected workflow/custodian channel                           |

Every variable has an owner, environments, rotation procedure, safe validation
rule, and redaction test. A checked-in example file contains names and safe
descriptions only.

## Database connectivity

- Vercel's serverless request path uses Supabase's currently supported
  transaction pooler.
- Driver prepared statements are disabled when required by transaction pooling.
- Connections are bounded and have statement/transaction timeouts.
- Migrations, pg_dump/restore, and administrative verification use the
  provider-recommended direct or session connection, not the request pool.
- No external AI or Storage call occurs while a database transaction is open.
- Advisory locks are transaction-scoped when used for one-time bootstrap or
  migration coordination.

Connection behavior is a deployment validation item because pooler availability
and network modes differ by plan and can change.

## Delivery pipeline

### Pull request

1. Install from the lockfile.
2. Lint, typecheck, unit test, and build.
3. Run API schema/contract tests.
4. Start an isolated PostgreSQL/Supabase test service.
5. Apply all migrations from zero and verify the expected head.
6. Run grants, RLS, trigger, concurrency, idempotency, and job tests.
7. Run browser accessibility and critical Playwright flows with fictional data.
8. Scan source/build/test output for secrets and prohibited sensitive content.
9. Deploy a protected fictional preview only after checks pass.

### Staging promotion

1. Produce one immutable commit/release candidate.
2. Review the migration plan and destructive-operation report.
3. Back up staging and apply migrations through a protected job.
4. Qualify login, account lifecycle, record history, RAG citations, private
   objects, queues, exports, logout, and dependency-failure behavior.
5. Record current provider limits and cost measurements.

### Production promotion

1. Confirm security/records/owner approvals and current allowed data classes.
2. Confirm backup and restore evidence.
3. Reuse the qualified commit; do not rebuild mutable release inputs.
4. Take the required pre-migration backup.
5. Apply forward migration and run schema/grants/RLS verification.
6. Deploy Next.js and, if applicable, the exact qualified worker release.
7. Run content-safe smoke tests.
8. Monitor auth denials, errors, database saturation, queue age/depth, job
   failures, AI latency/error rate, and Storage errors.
9. Roll back application code if necessary; correct database state with a new
   forward migration rather than editing applied history.

## Migration policy

- Migrations are immutable after application to any shared environment.
- Prefer expand/migrate/contract changes.
- Destructive steps are isolated, owner-approved, and preceded by count/hash/FK
  validation and backup evidence.
- New constraints on existing data use a validation-safe rollout.
- Every foreign key and RLS predicate has a supporting index.
- Database functions fix search_path and receive explicit execute grants.
- Seed scripts are fictional, idempotent, and impossible to target production
  accidentally.

The legacy duplicate paperwork migrations require the additive process in
[legacy-migration.md](legacy-migration.md); they must not be “fixed” by
rewriting old migration files.

## Backup and recovery

The owner has set a two-year retention rule and holds restore authority. RPO,
RTO, legal-hold operation, and restore evidence remain required before real-data
production entry.

Minimum design:

- scheduled PostgreSQL logical export in addition to provider backup/PITR when
  available;
- separate versioned backup of private Storage bytes and object metadata;
- encrypted, access-controlled backup destination outside the failure boundary
  being protected;
- restore runbook that rebuilds Auth/application mapping, schema, grants/RLS,
  corpus objects, chunks/vectors, queue definitions, and application config;
- recurring restore test with recorded duration and reconciliation checks.

Supabase database backups do not substitute for a Storage-object backup. Free
project backup behavior must be validated and is not acceptable as an unstated
production recovery plan.

## Free-tier validation gate

Before relying on a no-cost plan, capture a dated result for:

- intended use permitted by plan terms;
- inactivity pausing;
- Auth user/rate/password-policy features;
- database size, connections, pooler path, extensions, and compute;
- Storage size, object size, bandwidth, signed URL behavior, and backups;
- queue/pgmq availability and monitoring;
- vector dimensions/index capacity and embedding workload;
- Vercel build, function count, duration, memory, body size, logs, regions,
  cron/queue support, and deployment protection;
- AI request/token/rate limits and data-handling settings.

Exceeding a limit must produce a planned upgrade or bounded feature reduction,
not a disabled security control. Production may require paid Vercel/Supabase
plans even when development remains free.

## Required environment evidence

- environment inventory with owners and region;
- secret names/rotation dates without values;
- migration head and checksum;
- grants/RLS/bucket-policy test report;
- backup timestamp and successful restore record;
- fictional-versus-real data declaration;
- qualified release commit and smoke-test result;
- observed quotas, alerts, and upgrade thresholds.
