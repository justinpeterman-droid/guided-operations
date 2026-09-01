# Operations handbook

These documents define the intended operating model for Guided Operations on
Vercel and Supabase. They are control specifications, not deployment evidence.

## Current status

Updated 2026-08-31. The application was released to production on 2026-08-30;
see [Production release](2026-08-30-production-release.md) and
[Production corpus registration and import](2026-08-30-production-corpus-import.md).
The authoritative list of what remains open is
[Current open items](../../ROADMAP.md#current-open-items).

- Application hosting: **Git-connected Vercel project; the released deployment
  returned `ok` from `/api/health/live` and `ready` from `/api/health/ready` on
  2026-08-30**
- Supabase: **production project carries the corpus, facility, roster, accounts
  and audit events; local and remote migration histories matched exactly at the
  release**
- Corpus: **236 documents registered and 235 imported on 2026-08-30; all remain
  `awaiting_review` with `qa_approved = false`, so nothing is embedded or
  searchable**
- CI/release automation: **GitHub Actions failed before assigning a runner from
  2026-08-28 to 2026-08-31 because the private repository's included minutes
  were exhausted; the allowance reset on 2026-09-01 and workflows run again, but
  no `main` commit from the outage window has a passing CI run**
- Backups and restore exercise: **local fictional database-plus-Storage
  rehearsal and encrypted off-provider tooling implemented; hosted schedule, key
  custody, decryption proof and isolated restore not established**
- Monitoring and alerts: **strict redacted core application events implemented;
  hosted sinks, dashboards, alerts, budgets, access and retention not
  established**
- Production domain or traffic: **released and serving invited users**
- Intended use: **private, single-facility Production app for selected invited
  officers; not represented as an official agency/facility system**
- GCP retirement: **not authorized or performed**
- Real operational/personal data: **authorized in Production by O-015; O-013
  administrator assurance remains an unresolved gate**

## Control labels

| Label         | Meaning                                                                                                          |
| ------------- | ---------------------------------------------------------------------------------------------------------------- |
| **AUTOMATED** | A repeatable CI or monitoring control must produce machine-readable evidence.                                    |
| **MANUAL**    | A trained operator performs and records a repeatable check.                                                      |
| **OWNER**     | The repository/product owner makes a business, content, risk, or release decision. Automation cannot satisfy it. |
| **EXTERNAL**  | A provider, DNS administrator, content owner, or other outside dependency must be verified.                      |

## Document map

| Document                                                                                       | Purpose                                                                                                                 |
| ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| [`2026-08-28-hosted-readiness-refresh.md`](2026-08-28-hosted-readiness-refresh.md)             | Current read-only Vercel access, Supabase migration, advisor, and Production-isolation evidence.                        |
| [`2026-08-28-development-migration-dry-run.md`](2026-08-28-development-migration-dry-run.md)   | Exact read-only Development pending-migration list and no-apply evidence.                                               |
| [`2026-08-28-pending-migration-review.md`](2026-08-28-pending-migration-review.md)             | Lock, compatibility, authorization, and rollback review of the exact pending SQL suffix.                                |
| [`2026-08-28-development-data-boundary.md`](2026-08-28-development-data-boundary.md)           | Value-free proof that Development contains only the exact fictional identity fixture and no operational/Storage data.   |
| [`2026-08-28-dependency-review.md`](2026-08-28-dependency-review.md)                           | Current locked-package audit, registry-signature evidence, update disposition, and GitHub scanner limitations.          |
| [`2026-08-28-local-candidate.md`](2026-08-28-local-candidate.md)                               | Exact-commit local/CI qualification evidence and the hosted, content, manual, owner, and promotion limits.              |
| [`2026-08-27-command-center-requalification.md`](2026-08-27-command-center-requalification.md) | Exact candidate, CI, protected-Preview, Development database, and Production-isolation evidence.                        |
| [`production-execution-checklist.md`](production-execution-checklist.md)                       | Evidence-backed execution tracker for the gated path from foundation to isolated live Production.                       |
| [`non-production-migration-reconciliation.md`](non-production-migration-reconciliation.md)     | Evidence and stop conditions for aligning shared non-production migration history without changing the hosted database. |
| [`environments-and-secrets.md`](environments-and-secrets.md)                                   | Local, preview, staging-equivalent, and production isolation; regions; secret inventory and rotation.                   |
| [`database-migrations.md`](database-migrations.md)                                             | Supabase migration workflow, RLS review, compatibility, and recovery.                                                   |
| [`release-gates.md`](release-gates.md)                                                         | Required automated, manual, owner, and external evidence.                                                               |
| [`deployment-and-rollback.md`](deployment-and-rollback.md)                                     | Vercel/Supabase release order, smoke checks, and application/data rollback.                                             |
| [`backup-and-restore.md`](backup-and-restore.md)                                               | Database and Supabase Storage backups, corpus recovery, and restore exercises.                                          |
| [`incident-response.md`](incident-response.md)                                                 | Severity, containment, communications, recovery, and post-incident review.                                              |
| [`real-data-governance.md`](real-data-governance.md)                                           | Production-only data boundary, two-year retention, deletion, and release conditions.                                    |
| [`production-data-inventory.md`](production-data-inventory.md)                                 | Machine-checked database, Storage, AI, log, browser, and backup data-surface inventory.                                 |
| [`observability-and-costs.md`](observability-and-costs.md)                                     | Signals, redaction, alerting, free-plan limitations, and budget controls.                                               |
| [`dependency-maintenance.md`](dependency-maintenance.md)                                       | Dependency, runtime, lockfile, and supply-chain maintenance.                                                            |
| [`gcp-retirement.md`](gcp-retirement.md)                                                       | Evidence-gated migration away from all Google hosting and infrastructure.                                               |

## Operating assumptions

- Private application with application-level authentication and
  database-enforced authorization.
- One facility; the schema should still carry an explicit facility boundary so
  accidental global queries are testable.
- Real operational/personal data is permitted only in isolated Production after
  release gates; development, Preview, staging, and qualification remain
  fictional.
- The approved policy/reference corpus and minimum-necessary authorized
  operational records are the only allowed real content in Production.
- United States hosting; initial latency-aligned assumption is Supabase
  `us-east-1` and Vercel Functions `iad1`, pending owner confirmation and
  recorded provider availability.
- Vercel and Supabase are the only target hosting platforms. Google-hosted
  runtime, database, storage, retrieval, DNS redirects, or background jobs are
  out of scope for the replacement.
- AI integration is provider-neutral. OpenAI may be the first provider, but
  domain code must not depend directly on provider response objects.
- Plan limitations are explicit release gates rather than hidden risk acceptance
  before the product can hold real data.

## Source references

- [Vercel environments and environment variables](https://vercel.com/docs/environment-variables)
- [Vercel deployment protection](https://vercel.com/docs/deployment-protection)
- [Vercel rollback](https://vercel.com/docs/instant-rollback)
- [Supabase local development](https://supabase.com/docs/guides/local-development/cli-workflows)
- [Supabase migrations](https://supabase.com/docs/guides/local-development/database-migrations)
- [Supabase environment management](https://supabase.com/docs/guides/deployment/managing-environments)
- [Supabase backups](https://supabase.com/docs/guides/platform/backups)
- [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)
