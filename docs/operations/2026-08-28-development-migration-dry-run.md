# Development migration dry-run — 2026-08-28

- **Target:** linked fictional-data Supabase project named `guided-operations`
- **Region/state:** `us-east-1`, `ACTIVE_HEALTHY`
- **Target verification:** linked project reference exactly matched the ignored
  local Development `NEXT_PUBLIC_SUPABASE_URL`; no reference or credential is
  retained in this evidence
- **Repository commit:** `f18cc00482c4c8890797823089812efe56377929`
- **Working tree:** uncommitted reviewed candidate changes present
- **Operation:** read-only linked migration dry-run
- **Hosted changes:** none
- **Real data:** none read, written, or processed

## Command and result

```powershell
supabase db push --dry-run --linked --include-all --skip-vault
```

Supabase CLI `2.115.0` returned `dryRun: true`, with no seed or role changes,
and proposed exactly these 13 migrations in order:

1. `20260827130000_add_daily_paperwork_template_registry.sql`
2. `20260827131000_cover_daily_templates_in_backup_freeze.sql`
3. `20260827132000_bind_daily_paperwork_to_session_authority.sql`
4. `20260827133000_add_daily_paperwork_workflow.sql`
5. `20260827134000_return_report_revision_conflicts.sql`
6. `20260827135000_add_report_revision_docx_export.sql`
7. `20260828143000_add_personal_session_revocation.sql`
8. `20260828150000_harden_personal_passcode_revocation.sql`
9. `20260828151000_add_daily_paperwork_template_packages.sql`
10. `20260828173000_add_local_policy_ingestion_pipeline.sql`
11. `20260828200000_add_collection_filtered_policy_retrieval.sql`
12. `20260828210000_add_hybrid_policy_retrieval.sql`
13. `20260828220000_enforce_policy_page_range_approval.sql`

The earlier read-only refresh recorded 62 hosted migrations through
`20260827120000_enforce_report_finalization_authority`. The current repository
contains 75 migrations; the 13-item proposal therefore reconciles exactly and
does not attempt to replay an existing migration.

## Gate status

This proves only the pending-list comparison. It is not approval to apply SQL.
Before a non-production apply:

- the page-QA security fix must remain unchanged from the independently reviewed
  and locally verified candidate;
- the exact working tree must become a reviewed commit;
- all 13 pending migrations and rollback/recovery behavior must be reviewed as
  one additive set;
- local database reset, lint, pgTAP, and generated-type checks must pass again
  on that exact commit;
- GitHub must execute and pass the required exact-commit checks; and
- the owner-controlled non-production apply path must record its exact target
  and approval.

Stop if the linked target changes, the pending list changes, a migration moves
behind the hosted head, real data is discovered, or the final candidate differs
from the reviewed commit.
