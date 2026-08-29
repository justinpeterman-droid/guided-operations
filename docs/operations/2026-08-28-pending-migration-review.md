# Pending Development migration review — 2026-08-28

- **Scope:** the exact 13-migration suffix recorded in
  [`2026-08-28-development-migration-dry-run.md`](2026-08-28-development-migration-dry-run.md)
- **Review type:** local SQL/authorization/lock/recovery review plus existing
  complete local database replay evidence
- **Hosted changes:** none
- **Decision:** suitable for a later controlled apply to the verified
  fictional-only Development project only after the open release blockers clear
- **Production authority:** none

## Review result

No migration performs a table/schema drop, truncate, migration-time row delete,
bulk backfill, extension install, anonymous/public grant, or out-of-transaction
DDL. Every file has one explicit `begin`/`commit` boundary. Data-changing SQL
identified by the static review is inside newly defined functions and therefore
does not run during migration apply.

The set is additive or narrowly replaces already-versioned functions:

- Daily Paperwork adds the private immutable template/package registry, bounded
  schemas, backup-freeze coverage, append-only records/history/restore/print
  operations, and session-authorized v2 APIs.
- Report changes replace the append conflict contract and add reviewed revision
  DOCX/print export functions.
- Personal-session changes add a nullable reconciliation timestamp, replace the
  Auth token hook, and harden private compare-and-swap passcode/session
  revocation functions.
- Policy ingestion adds canonical collection/provenance fields, stricter source
  validation, page/chunk metadata, and deterministic run-scoped uniqueness.
- Retrieval v3/v4 adds canonical collection filtering and exact-profile hybrid
  lexical/vector rank fusion; the previous retrieval functions are retained for
  rollback compatibility.
- The page-range hardening migration requires every physical page in a bounded
  chunk citation range to exist and be approved, serializes evidence changes
  against embedding-provider egress, and clears stale run/page/chunk QA when
  reviewed evidence changes.

All reviewed `security definer` functions set an empty search path. New private
tables force RLS and revoke direct public/anonymous/authenticated/service-role
table access. Private helpers revoke direct execution, while the intended API
functions grant execution only to `authenticated`; the Auth hook grants only to
`supabase_auth_admin`.

## Lock and compatibility notes

The migrations use ordinary `alter table` and non-concurrent index creation.
That takes short exclusive locks. The current Development project has one exact
fictional fixture identity plus bounded audit/rate-limit metadata, while every
operational table and Storage object inventory is empty. The touched identity
change is one nullable column; the new unique indexes target empty paperwork and
policy tables. See
[`2026-08-28-development-data-boundary.md`](2026-08-28-development-data-boundary.md).
Stop and reassess if another identity, any operational row, or any Storage
object appears before apply.

Unique indexes are created for template packages and ingestion/chunk identity.
They are safe on the verified empty target tables and are exercised by the local
reset and pgTAP suite; populated target tables require duplicate preflight
queries before apply.

The Daily Paperwork authority migration revokes execution of its older v1
functions after creating v2 replacements. The Auth migration replaces the live
token hook. Therefore the compatible application candidate, Auth hook setting,
and migration set must be promoted as one coordinated release; an older web
build must not be left serving after apply.

The ingestion migration adds enum values. PostgreSQL cannot remove enum values
with a simple down migration, so rollback is a forward correction or restore to
an isolated pre-apply backup/project. The legacy system remains untouched.

## Remaining stop gates

This review does not authorize apply. Before rerunning the dry-run and applying:

1. keep the independently reviewed `rag/page-qa-egress` fix unchanged;
2. create and review the exact commit;
3. repeat local reset, lint, pgTAP, type generation/check, web, security, and
   migration-history checks on that commit;
4. restore GitHub runner execution and obtain every required green check;
5. rerun the fictional Development boundary check and confirm the exact fixture,
   zero operational rows, two private buckets, and zero Storage objects; and
6. obtain the recorded non-production apply authorization for the unchanged
   13-item list.

Any pending-list, target, data-state, grant, Auth-hook, or candidate change
invalidates this review and requires a new one.
