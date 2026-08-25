# ADR-0006: Design for One Facility

- **Status:** Accepted
- **Date:** 2026-08-25
- **Deciders:** Product owner and technical lead

## Context

The product is for one facility. Adding multi-tenant facility IDs, tenant-aware
roles, cross-tenant operator controls, tenant provisioning, and tenant billing
would expand every schema, RLS policy, cache key, object path, job, audit event,
and test without a current requirement.

## Decision

Build one deployment and one authoritative facility configuration.

- Do not add tenant_id/facility_id to every table.
- Authorization is account role plus record ownership/preparer/access within the
  single facility.
- A singleton facility_settings record may hold reviewed display/timezone/form
  configuration, but it is not a tenant boundary.
- Environment separation is not tenancy.
- A second facility requires a new ADR and migration design.

## Options considered

### Option A: Explicit single-facility model

| Dimension                     | Assessment               |
| ----------------------------- | ------------------------ |
| Complexity                    | Low                      |
| RLS clarity                   | High                     |
| Current fit                   | Exact                    |
| Future multi-tenant migration | Requires deliberate work |

Pros:

- Small, auditable authorization surface.
- Fewer opportunities to omit a tenant predicate.
- Faster feature migration and simpler operations.

Cons:

- Supporting a second facility is not a configuration toggle.
- Some tables may need additive facility ownership later.

### Option B: Multi-tenant shared database from day one

| Dimension             | Assessment                        |
| --------------------- | --------------------------------- |
| Complexity            | High                              |
| Current fit           | Speculative                       |
| Future onboarding     | Easier only if designed correctly |
| Security test surface | Much larger                       |

Pros:

- Potential shared-platform path for multiple facilities.

Cons:

- Tenant isolation must touch every query, RLS policy, object, queue, cache, and
  admin action.
- Adds global/facility admin concepts with no owner requirement.
- A missed predicate can create severe data exposure.

### Option C: Separate deployment/project per facility

| Dimension        | Assessment                    |
| ---------------- | ----------------------------- |
| Isolation        | Strong                        |
| Operational cost | High per facility             |
| Current fit      | Unnecessary but future option |

Pros:

- Strong infrastructure isolation.
- Single-facility application model can remain.

Cons:

- Repeated deployments, migrations, monitoring, Auth, and costs.
- Cross-facility management would need separate tooling.

## Trade-off analysis

Single-facility design minimizes current security and maintenance risk. If a
second facility is requested, separate deployments may remain safer than shared
tenancy; that decision should be made with actual scale, ownership, and data
sharing requirements.

## Consequences

- No facility selector or cross-facility role exists.
- Facility timezone/display settings are centralized and cannot be supplied by
  arbitrary request fields.
- RLS focuses on active account, role, ownership, preparer, explicit access, and
  resource type.
- Object keys need no tenant prefix but still use immutable parent IDs and
  classifications.
- Tests must not imply cross-tenant security that does not exist.
- Future multi-facility work requires a new context/tenant model, data backfill,
  compound uniqueness review, RLS rewrite, queue/cache/object scoping, and
  migration plan.

## Action items

1. [ ] Define the singleton facility_settings schema and timezone behavior.
2. [ ] Remove speculative tenant/facility request fields from API schemas.
3. [ ] Test record ownership and admin authority within the one-facility
       boundary.
4. [ ] Revisit only when a concrete second-facility requirement and owner exist.
