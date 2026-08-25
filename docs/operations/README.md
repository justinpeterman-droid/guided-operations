# Operations handbook

These documents define the intended operating model for Guided Operations on
Vercel and Supabase. They are control specifications, not deployment evidence.

## Current status

- Application hosting configured: **not established by this repository**
- Supabase projects configured: **not established**
- CI/release automation configured: **not established**
- Backups and restore exercise: **not established**
- Monitoring and alerts: **not established**
- Production domain or traffic: **not established**
- Intended use: **personal, non-commercial hobby app for selected invited
  officers; not an official agency/facility system**
- GCP retirement: **not authorized or performed**
- Real operational-data use: **prohibited**
- Approved real content: policy/reference corpus only, subject to the corpus
  handling standard

No checklist item may be marked complete without dated evidence identifying the
environment, commit/deployment, actor, command or dashboard observation, result,
and retained artifact location.

## Control labels

| Label         | Meaning                                                                                                          |
| ------------- | ---------------------------------------------------------------------------------------------------------------- |
| **AUTOMATED** | A repeatable CI or monitoring control must produce machine-readable evidence.                                    |
| **MANUAL**    | A trained operator performs and records a repeatable check.                                                      |
| **OWNER**     | The repository/product owner makes a business, content, risk, or release decision. Automation cannot satisfy it. |
| **EXTERNAL**  | A provider, DNS administrator, content owner, or other outside dependency must be verified.                      |

## Document map

| Document                                                     | Purpose                                                                                               |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| [`environments-and-secrets.md`](environments-and-secrets.md) | Local, preview, staging-equivalent, and production isolation; regions; secret inventory and rotation. |
| [`database-migrations.md`](database-migrations.md)           | Supabase migration workflow, RLS review, compatibility, and recovery.                                 |
| [`release-gates.md`](release-gates.md)                       | Required automated, manual, owner, and external evidence.                                             |
| [`deployment-and-rollback.md`](deployment-and-rollback.md)   | Vercel/Supabase release order, smoke checks, and application/data rollback.                           |
| [`backup-and-restore.md`](backup-and-restore.md)             | Database and Supabase Storage backups, corpus recovery, and restore exercises.                        |
| [`incident-response.md`](incident-response.md)               | Severity, containment, communications, recovery, and post-incident review.                            |
| [`observability-and-costs.md`](observability-and-costs.md)   | Signals, redaction, alerting, free-plan limitations, and budget controls.                             |
| [`dependency-maintenance.md`](dependency-maintenance.md)     | Dependency, runtime, lockfile, and supply-chain maintenance.                                          |
| [`gcp-retirement.md`](gcp-retirement.md)                     | Evidence-gated migration away from all Google hosting and infrastructure.                             |

## Operating assumptions

- Private application with application-level authentication and
  database-enforced authorization.
- One facility; the schema should still carry an explicit facility boundary so
  accidental global queries are testable.
- The initial hosted target is a private hobby release for selected invited
  officers. Any official organizational adoption is a new scope and approval.
- No real operational data during development, preview, staging, or initial
  production qualification.
- The approved policy/reference corpus is the only real content.
- United States hosting; initial latency-aligned assumption is Supabase
  `us-east-1` and Vercel Functions `iad1`, pending owner confirmation and
  recorded provider availability.
- Vercel and Supabase are the only target hosting platforms. Google-hosted
  runtime, database, storage, retrieval, DNS redirects, or background jobs are
  out of scope for the replacement.
- AI integration is provider-neutral. OpenAI may be the first provider, but
  domain code must not depend directly on provider response objects.
- Free plans are preferred while the product contains no operational data, but
  plan limitations are explicit release gates rather than hidden risk
  acceptance.

## Source references

- [Vercel environments and environment variables](https://vercel.com/docs/environment-variables)
- [Vercel deployment protection](https://vercel.com/docs/deployment-protection)
- [Vercel rollback](https://vercel.com/docs/instant-rollback)
- [Supabase local development](https://supabase.com/docs/guides/local-development/cli-workflows)
- [Supabase migrations](https://supabase.com/docs/guides/local-development/database-migrations)
- [Supabase environment management](https://supabase.com/docs/guides/deployment/managing-environments)
- [Supabase backups](https://supabase.com/docs/guides/platform/backups)
- [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)
