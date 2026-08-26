# Operations handbook

These documents define the intended operating model for Guided Operations on
Vercel and Supabase. They are control specifications, not deployment evidence.

## Current status

- Application hosting configured: **authoritative Git-connected Vercel project
  and protected Previews verified; current signed-in candidate qualification
  incomplete**
- Supabase projects configured: **new `us-east-1` foundation project healthy; no
  users or operational data**
- CI/release automation configured: **GitHub web, database, and fictional
  recovery workflows pass; production promotion remains manual and gated**
- Backups and restore exercise: **local fictional database-plus-Storage
  rehearsal implemented; encrypted off-provider and isolated hosted restore not
  established**
- Monitoring and alerts: **strict redacted core application events implemented;
  hosted sinks, dashboards, alerts, budgets, access, and retention not
  established**
- Production domain or traffic: **not established**
- Intended use: **personal, non-commercial hobby app for selected invited
  officers; not an official agency/facility system**
- GCP retirement: **not authorized or performed**
- Real operational/personal data: **Production-only after release gates**
- Production retention: **two years from final revision**, subject to legal hold

No checklist item may be marked complete without dated evidence identifying the
environment, commit/deployment, actor, command or dashboard observation, result,
and retained artifact location.

See the dated
[`2026-08-25 hosted foundation record`](2026-08-25-hosted-foundation.md) for the
current provider evidence and explicit limitations.

## Control labels

| Label         | Meaning                                                                                                          |
| ------------- | ---------------------------------------------------------------------------------------------------------------- |
| **AUTOMATED** | A repeatable CI or monitoring control must produce machine-readable evidence.                                    |
| **MANUAL**    | A trained operator performs and records a repeatable check.                                                      |
| **OWNER**     | The repository/product owner makes a business, content, risk, or release decision. Automation cannot satisfy it. |
| **EXTERNAL**  | A provider, DNS administrator, content owner, or other outside dependency must be verified.                      |

## Document map

| Document                                                                 | Purpose                                                                                               |
| ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| [`production-execution-checklist.md`](production-execution-checklist.md) | Evidence-backed execution tracker for the gated path from foundation to live hobby production.        |
| [`environments-and-secrets.md`](environments-and-secrets.md)             | Local, preview, staging-equivalent, and production isolation; regions; secret inventory and rotation. |
| [`database-migrations.md`](database-migrations.md)                       | Supabase migration workflow, RLS review, compatibility, and recovery.                                 |
| [`release-gates.md`](release-gates.md)                                   | Required automated, manual, owner, and external evidence.                                             |
| [`deployment-and-rollback.md`](deployment-and-rollback.md)               | Vercel/Supabase release order, smoke checks, and application/data rollback.                           |
| [`backup-and-restore.md`](backup-and-restore.md)                         | Database and Supabase Storage backups, corpus recovery, and restore exercises.                        |
| [`incident-response.md`](incident-response.md)                           | Severity, containment, communications, recovery, and post-incident review.                            |
| [`real-data-governance.md`](real-data-governance.md)                     | Production-only data boundary, two-year retention, deletion, and release conditions.                  |
| [`production-data-inventory.md`](production-data-inventory.md)           | Machine-checked database, Storage, AI, log, browser, and backup data-surface inventory.               |
| [`observability-and-costs.md`](observability-and-costs.md)               | Signals, redaction, alerting, free-plan limitations, and budget controls.                             |
| [`dependency-maintenance.md`](dependency-maintenance.md)                 | Dependency, runtime, lockfile, and supply-chain maintenance.                                          |
| [`gcp-retirement.md`](gcp-retirement.md)                                 | Evidence-gated migration away from all Google hosting and infrastructure.                             |

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
