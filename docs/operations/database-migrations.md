# Database migrations

Supabase PostgreSQL schema is source-controlled under `supabase/migrations/`.
Dashboard edits are not a normal development path. The repository must be able
to recreate a new environment from migrations plus fictional seed data and
approved corpus manifests.

## Migration invariants

- Every application table has a primary key, explicit timestamps where lifecycle
  matters, constraints for domain invariants, and indexes for foreign keys,
  common filters, joins, uniqueness, and RLS policy columns.
- RLS is enabled on every application table and Storage bucket policy before
  client access is granted.
- Grants follow least privilege. Browser requests use the authenticated role;
  elevated secret-key access is isolated to reviewed server administration
  paths.
- Facility, actor, ownership, role, and record-state boundaries are represented
  in the database and enforced by policy, not inferred only by the UI.
- Security-definer functions set an empty `search_path`, schema-qualify objects,
  expose the smallest possible return value, and have explicit execute grants.
- External calls and AI requests never occur inside a database transaction.
- Mutating workflows use short transactions, consistent lock ordering, unique
  constraints, atomic `insert ... on conflict`, and version predicates for
  stale-write detection.
- Migration filenames are immutable after they reach a shared environment.
  Correct mistakes with a new migration.

## Development workflow

Once the Supabase CLI foundation exists:

1. Create a timestamped migration:

   ```powershell
   supabase migration new descriptive_name
   ```

2. Write SQL explicitly. Include tables, constraints, indexes, grants, RLS
   policies, helper functions, and comments needed for the change.
3. Recreate the local stack from scratch:

   ```powershell
   supabase db reset --local
   ```

4. Run database lint, pgTAP/schema/RLS tests, `npm run db:types:check`,
   application integration tests, and concurrency tests.
5. Regenerate TypeScript database types from the local schema and commit the
   reviewed result.
6. Review the SQL and query plans for common access paths. Confirm indexed
   foreign keys and RLS predicates.
7. Open a pull request with migration risk, compatibility window, expected
   locks, backup requirement, and recovery plan.

Commands are target workflow until the CLI and scripts are added. Their absence
blocks the database gate.

## Change patterns

### Additive change

1. Add nullable column/table/function/policy and required indexes.
2. Deploy code that can read old and new shapes.
3. Backfill in bounded batches outside long transactions if needed.
4. Add constraints using a low-lock strategy and validate existing rows.
5. Make the new field required only after all callers are compatible.

### Rename or breaking change

Use expansion/contraction:

1. Add the replacement field/API while retaining the old one.
2. Dual-read or dual-write in a deliberately bounded compatibility release.
3. Backfill and verify counts/checksums.
4. Switch reads.
5. Remove old behavior in a later release after rollback compatibility expires.

### Authorization change

Treat every RLS or grant change as security-critical:

- list the exact roles and operations affected;
- prove anonymous denial;
- prove same-user/same-facility allow cases;
- prove cross-user, cross-role and missing-membership denial;
- test `select`, `insert`, `update`, and `delete` separately;
- test old rows, null ownership, forged identifiers, direct REST access, and
  Storage paths;
- inspect policy performance and index every authorization predicate.

## Remote non-production

Only an approved release-candidate migration set is applied to the shared
non-production project.

1. Verify the linked project reference and region.
2. Confirm it contains only fictional data and approved corpus content.
3. Capture the current migration list and an export if the state is worth
   preserving.
4. Preview pending changes:

   ```powershell
   supabase db push --dry-run
   ```

5. Apply pending migrations with an authenticated operator or protected CI job.
6. Compare local and remote migration history, then run RLS, auth, browser and
   AI qualification.

A remote reset is permitted only for the explicitly disposable non-production
project, with target verification and owner/operator awareness. Never run
`supabase db reset --linked` against production.

## Production sequence

**AUTOMATED:** CI proves replay and compatibility. **OWNER:** approves the exact
migration set. **MANUAL/AUTOMATED:** a protected production job applies it.

1. Confirm provider status and current production health.
2. Record project reference alias, region, current migration head and
   application deployment.
3. Create and verify pre-migration database and Storage backup identifiers when
   required.
4. Confirm the current application and rollback deployment are compatible with
   the post-migration schema.
5. Run the migration dry-run against production credentials in a protected
   environment.
6. Apply additive migrations before application promotion when both old and new
   application versions can use the result.
7. Promote the application.
8. Run authenticated role-scoped smoke tests without creating operational data.
9. Verify migration history, constraints, RLS, error rate, latency, connections,
   locks and audit events.
10. Record outcome. Cleanup/contraction migrations occur in a later release.

## Recovery

Database rollback and application rollback are different operations.

- Prefer a forward-fix migration for additive or repairable defects.
- Use Vercel rollback only when the old application is schema-compatible.
- Do not automatically run general-purpose down migrations in production.
- Restore to a new Supabase project when corruption or destructive migration
  requires data recovery; validate privately before changing application
  configuration.
- Never restore production data into preview or developer environments.

Every risky migration must state one recovery path:

1. forward fix;
2. disable the affected feature while retaining data;
3. application rollback against compatible schema; or
4. full database and Storage restore into a replacement project.

## Drift and evidence

- Production schema changes through the Dashboard are prohibited except an
  incident commander-approved emergency.
- Capture an emergency Dashboard change immediately as a migration, test it, and
  reconcile migration history before normal releases resume.
- Run scheduled migration-history and generated-type drift checks.
- Retain the exact SQL, review, dry-run output, start/end time, migration head,
  backup identifier and verification result in the release record.

Reference:
[Supabase database migrations](https://supabase.com/docs/guides/local-development/database-migrations)
and
[local workflow](https://supabase.com/docs/guides/local-development/cli-workflows).
