# Definition of done

Use this document to distinguish four states:

1. a change is code-complete;
2. a release candidate is qualified;
3. an owner-authorized deployment is verified;
4. a future, separately authorized official facility use is approved.

These states are not interchangeable. A merged pull request or green CI is not a
deployment, production approval, pilot approval, or authorization to use real
operational data.

## Change done

All applicable items are required.

### Scope and design

- [ ] **MANUAL:** Acceptance criteria, non-goals, affected roles, failure
      states, and data classification are recorded.
- [ ] **MANUAL:** The change stays within the private, web-only,
      single-facility, no-operational-data boundary.
- [ ] **OWNER:** Any material behavior, policy interpretation, new provider, new
      data class, or scope change is approved.
- [ ] **MANUAL:** Architecture/schema/security decisions with lasting impact
      have an ADR or equivalent decision record.

### Implementation

- [ ] **MANUAL:** Server/client boundaries are explicit; privileged keys and AI
      provider calls remain server-only.
- [ ] **MANUAL:** Input validation, authorization, error states, timeouts, retry
      limits, idempotency, and concurrency behavior are implemented.
- [ ] **MANUAL:** Schema change is a versioned migration with constraints,
      indexes, grants, RLS, rollback/forward-recovery notes, and generated
      types.
- [ ] **MANUAL:** Private Storage uses restrictive bucket configuration and
      RLS-backed object access.
- [ ] **MANUAL:** Logs and analytics contain no secrets, corpus text,
      prompts/responses, or operational/personal content.
- [ ] **MANUAL:** AI behavior is provider-neutral, corpus-scoped, cited,
      refusal-safe, bounded by tokens/cost, and honest when unavailable.

### Verification

- [ ] **AUTOMATED:** Lint, types, build, unit, component, and applicable
      integration tests pass on the exact commit.
- [ ] **AUTOMATED:** PostgreSQL constraints/migrations and applicable
      RLS/Auth/Storage/concurrency/idempotency tests pass against local
      Supabase.
- [ ] **AUTOMATED:** Dependency, secret, and configured security scans pass or
      have an approved disposition.
- [ ] **AUTOMATED/MANUAL:** Synthetic AI evaluations show no safety or citation
      regression.
- [ ] **MANUAL:** Real-browser behavior, visible text/assets, routes,
      console/network errors, keyboard flow, responsive states, and failures are
      reviewed.
- [ ] **MANUAL:** Affected visual snapshots and print/PDF artifacts are
      intentionally reviewed, not blindly regenerated.
- [ ] **AUTOMATED/MANUAL:** Accessibility checks and applicable
      assistive-technology flows pass WCAG 2.2 AA targets.

### Documentation and review

- [ ] **MANUAL:** User, architecture, environment, migration, operations,
      testing, and rollback documentation is updated as applicable.
- [ ] **MANUAL:** No secret, real operational data, unapproved corpus file,
      debug artifact, or unrelated change is in the diff.
- [ ] **MANUAL:** A reviewer independent of the author has reviewed the code and
      evidence.
- [ ] **MANUAL:** Known limitations have an owner, risk, target date, and
      release impact.

## Release candidate qualified

In addition to change-done items:

- [ ] **AUTOMATED:** All required protected CI lanes pass for the pinned commit.
- [ ] **MANUAL:** The pinned Vercel preview uses the intended non-production
      Supabase project and environment variables.
- [ ] **MANUAL:** Migrations apply from a clean database and the prior release
      schema; drift is resolved.
- [ ] **MANUAL:** Auth, RLS, Storage, revoked-session, and cross-user negative
      tests pass in non-production.
- [ ] **MANUAL/AUTOMATED:** Approved-corpus retrieval/citation/refusal/injection
      evaluations pass under access control.
- [ ] **MANUAL:** Authenticated fictional end-to-end, visual, print,
      accessibility, and degraded-provider workflows pass.
- [ ] **MANUAL:** Database and Storage backups are current, checksummed, and a
      restore drill meets or has owner-accepted exceptions to the provisional
      recovery targets.
- [ ] **MANUAL:** Alerts, dashboards, incident contacts, plan/quota limits,
      budget breaker, and rollback procedure are tested.
- [ ] **EXTERNAL:** Vercel, Supabase, AI provider, DNS, and relevant facility
      dependencies are healthy and configured as recorded.
- [ ] **OWNER:** Residual risk, plan limitations, corpus version, migration set,
      deployment ID/commit, and release window are approved in writing.

Qualification says the candidate is eligible for owner-authorized promotion. It
does not mean it has been deployed.

## Deployment verified

Only complete this section after explicit owner authorization to deploy.

- [ ] **OWNER:** The production promotion and change window were explicitly
      authorized.
- [ ] **MANUAL:** Pre-deploy database and Storage backup evidence was recorded.
- [ ] **MANUAL:** The exact qualified commit/build was promoted; no unqualified
      rebuild or environment drift was introduced.
- [ ] **MANUAL:** The intended production Supabase project, US region, migration
      version, corpus manifest, and secret references were verified without
      exposing values.
- [ ] **MANUAL:** Production migration completed and the migration ledger
      matches the release record.
- [ ] **MANUAL:** Authenticated browser smoke tests pass using fictional
      accounts/data.
- [ ] **MANUAL:** Authorization negatives, private Storage access, RAG
      citations/refusal, print, and critical accessibility behavior pass.
- [ ] **MANUAL:** Metrics, logs, alerts, cost/quota signals, backups, and
      rollback controls are healthy.
- [ ] **OWNER:** Post-deploy evidence and any exceptions are accepted.

If any critical smoke, auth/RLS/Storage, corpus-integrity, backup, or telemetry
check fails, stop and follow the rollback/incident runbooks. Do not describe a
deployment as successful based only on build status, provider dashboard state,
or HTTP 200.

## Future official facility-use readiness

This section is outside the current hobby-app scope. A verified hobby deployment
is still not official facility-use approval.

- [ ] **OWNER/EXTERNAL:** Facility authority approves the workflow, policy
      corpus, user roles, training, support model, and acceptable-use
      boundaries.
- [ ] **OWNER/EXTERNAL:** Security, privacy, rights/licensing,
      records/retention, accessibility, and any legal/compliance review is
      complete.
- [ ] **OWNER:** Free-plan limitations—including pause behavior, backup
      coverage, log retention, quotas, and support—are accepted or replaced with
      a qualified paid plan.
- [ ] **MANUAL:** Incident lead/alternate, escalation path, status
      communications, and twice-yearly exercise schedule exist.
- [ ] **MANUAL:** Backup and restore objectives, monitoring retention, access
      review, dependency maintenance, and cost ownership are operational.
- [ ] **MANUAL:** Users are trained that AI output is policy assistance with
      citations, not autonomous authority, and know how to report
      conflicts/errors.
- [ ] **OWNER:** Pilot scope, success/stop criteria, rollback, support window,
      and named participants are approved.
- [ ] **OWNER:** The prohibition on real operational data remains visible and
      enforced.

Any future proposal to use real operational/personal data must satisfy the
separate scope-change gates in
[fictional-data-and-rag-content.md](fictional-data-and-rag-content.md). It
cannot be approved merely by checking this list.

## Evidence record

For every release, retain:

- release ID, commit SHA, pull request(s), Vercel build/deployment ID and URL;
- Supabase project/environment reference, region, migration versions, backup and
  restore evidence;
- corpus manifest/version and evaluation report identifiers without embedding
  corpus content;
- automated check links and manual browser/visual/print/accessibility evidence;
- provider status/plan verification, known risks/exceptions, incident and
  rollback contacts;
- owner/external approvals, timestamps, and post-deploy result.

An unchecked, skipped, unavailable, or unevidenced item is not passed. Mark it
blocked, not applicable with a reason and reviewer, or owner-accepted only where
the gate explicitly permits owner judgment.
