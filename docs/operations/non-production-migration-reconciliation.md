# Non-production migration reconciliation

- **Recorded:** 2026-08-27
- **Scope:** authoritative Supabase non-production project only
- **Data state on 2026-08-27:** empty application tables and empty private
  Storage buckets; one exact fictional qualification identity was added later
- **Hosted changes made by this reconciliation:** none

## Why reconciliation was required

The hosted project contained 10 migration records. The first six exactly matched
the repository. The next four had the same names and relative order as the
repository, but the provider API had recorded later generated timestamps:

| Migration                     | Repository version before | Shared version   |
| ----------------------------- | ------------------------- | ---------------- |
| `add_incident_create_rpc`     | `20260826051616`          | `20260826081654` |
| `add_current_account_rpc`     | `20260826052526`          | `20260826081658` |
| `add_auth_version_token_hook` | `20260826053055`          | `20260826081703` |
| `add_incident_list_rpc`       | `20260826060153`          | `20260826081706` |

A normal linked push would not be safe while those histories disagreed. The
hosted project was not reset, its migration table was not repaired, and no SQL
was reapplied.

## Evidence reviewed

- The intended project name, `us-east-1` region, healthy provider state, and the
  then-empty application/Storage inventory were rechecked.
- The complete ordered hosted migration list was compared with every repository
  filename.
- The affected hosted functions, identities, return types, language, volatility,
  `security definer` setting, empty search path, and execute grants were
  inspected.
- The hosted function bodies implement the same behavior as the four named
  repository migrations. Formatting and some comments differ, which is metadata
  drift rather than evidence that a different feature migration was applied.
- Moving the four repository versions forward does not change their order; all
  four still precede `20260826082406_add_policy_retrieval_rpc.sql`.

## Repository correction

The four repository files were renamed to their already-shared versions. Their
SQL contents were not changed. After the rename:

- hosted migration count: 10;
- repository migration count: 57;
- hosted migration head: `20260826081706`;
- repository migration head: `20260827070000`;
- result: the hosted history is an exact ordered repository prefix.

## Required proof before a hosted apply

- [x] Rebuild a new local database from all 57 migrations and fictional seed.
- [x] Pass database lint, all 411 pgTAP assertions, generated-type, and
      production-inventory checks in a clean checkout on 2026-08-27.
- [ ] Pass exact-head Web quality and recovery rehearsal CI.
- [x] Run a linked `supabase db push --dry-run` and confirm that it proposes
      only unapplied migrations. The 2026-08-28 refresh found the hosted head at
      `20260827120000` and proposed the exact 13-migration repository suffix;
      see
      [`2026-08-28-development-migration-dry-run.md`](2026-08-28-development-migration-dry-run.md).
- [x] Review the pending SQL for locks, compatibility, Auth/RLS/Storage changes,
      and rollback behavior. The empty-target-only lock assumptions, coordinated
      Auth/application promotion requirement, enum rollback limit, and remaining
      stop gates are recorded in
      [`2026-08-28-pending-migration-review.md`](2026-08-28-pending-migration-review.md).
- [ ] Record approval for the exact non-production apply.
- [ ] Apply, verify the exact head, and run hosted fictional qualification.

Stop if the dry-run proposes replaying any of the first 10 migrations, if the
target is not the verified non-production project, if any real operational or
personal data is present, or if the generated SQL differs from the reviewed
candidate.
