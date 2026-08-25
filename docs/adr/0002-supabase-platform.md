# ADR-0002: Use Supabase as the Core Data Platform

- **Status:** Accepted
- **Date:** 2026-08-25
- **Deciders:** Product owner and technical lead

## Context

The replacement must leave Google hosting entirely while retaining PostgreSQL,
employee authentication, private document objects, durable work, vector search,
immutable history, and strong authorization. Cost should begin low where
practical, but security and recoverability cannot depend on undocumented free
plan behavior.

## Decision

Use Supabase for:

- managed PostgreSQL in a United States region;
- Auth sessions and password verification;
- private Storage;
- Queues built on pgmq;
- pgvector plus PostgreSQL full-text search.

Use the non-exposed `app_private` schema, least-privileged roles/grants, a
server-side DAL, and RLS as defense in depth. The Data API exposes only the
locked `api` schema, which may later contain reviewed functions/views. Routine
user traffic does not use a service-role/RLS-bypass credential.

Vercel and Supabase regions are aligned. Separate projects isolate preview,
staging, and production as the chosen plans permit.

## Options considered

### Option A: Integrated Supabase platform

| Dimension                  | Assessment                                                |
| -------------------------- | --------------------------------------------------------- |
| Time to first secure slice | Medium                                                    |
| Operational burden         | Low-to-medium                                             |
| PostgreSQL compatibility   | Strong                                                    |
| Provider concentration     | Medium-high                                               |
| Initial cost               | Free/low-cost evaluation possible, validate current terms |

Pros:

- One managed boundary for Auth, PostgreSQL, Storage, queues, and vectors.
- PostgreSQL preserves constraints, revisions, JSONB, indexes, and transactions.
- Local tooling and SQL migrations support testable infrastructure.
- Reduces the number of providers needed at launch.

Cons:

- Auth username requirement needs an adapter decision.
- Service credentials are powerful and require strict isolation.
- RLS/grants and exposed-schema defaults can be misconfigured.
- Free-tier pausing/backups/capacity may be unsuitable for production.
- Provider concentration increases outage and migration impact.

### Option B: Separate managed products

Examples: independent PostgreSQL, Auth provider, object store, queue, and vector
database.

| Dimension                  | Assessment |
| -------------------------- | ---------- |
| Time to first secure slice | Slow       |
| Operational burden         | High       |
| Best-of-breed flexibility  | High       |
| Provider concentration     | Low        |
| Initial cost               | Variable   |

Pros:

- Each capability can be optimized independently.
- Less platform-specific coupling.

Cons:

- More secrets, IAM models, bills, failure modes, and integration code.
- Harder transactional job/outbox and identity/data authorization alignment.
- Unnecessary for one facility at current scale.

### Option C: Self-managed PostgreSQL and services

| Dimension                   | Assessment     |
| --------------------------- | -------------- |
| Control                     | High           |
| Operational burden          | Very high      |
| Initial cost                | Can appear low |
| Recovery/security ownership | Entirely ours  |

Pros:

- Maximum deployment control.
- Standard open-source components.

Cons:

- Patching, backups, HA, Auth, object storage, queues, and monitoring become
  project responsibilities.
- Conflicts with the goal of a maintainable small-system replacement.

### Option D: Continue Google Cloud

Not viable. It violates the explicit no-Google-hosting constraint.

## Trade-off analysis

Supabase introduces platform coupling but keeps the core in PostgreSQL and
private object storage, which remain exportable. Provider-specific calls are
isolated behind DAL/storage/queue adapters and SQL migrations. This is a better
fit than operating five independent services for a one-facility product.

## Consequences

- Supabase Auth identity is distinct from current application role/status.
- Product tables do not live in an exposed public schema.
- Grants and RLS are tested in CI for every operation/actor.
- Serverless connections use the qualified pooler configuration; migrations and
  backup tools use the provider-recommended direct/session path.
- Database and Storage require separate backups and restore reconciliation.
- Queues do not replace the authoritative job/outbox tables.
- Current free-tier limits are validation gates, not promises.
- A future migration remains feasible through PostgreSQL dumps, object exports,
  Auth/account mapping, and provider-neutral domain interfaces.

## Action items

1. [ ] Validate selected US region, PostgreSQL version, extensions, connection
       mode, and plans.
2. [ ] Create clean schemas, roles, grants, RLS, and database security tests.
3. [ ] Complete ADR-0003's hosted Auth spike.
4. [ ] Define private buckets and object lifecycle/backup.
5. [ ] Qualify pgmq/Queues delivery, monitoring, and consumer behavior.
6. [ ] Record free-to-paid upgrade triggers and production recovery
       requirements.
