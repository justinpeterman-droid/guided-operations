# Deployment and rollback

This runbook defines the intended Vercel/Supabase release process. No deployment
is authorized or proven by this document.

In this runbook, “Production” means the isolated Vercel Production deployment
and separate live Supabase project. The owner authorized real operational and
personal data only there, after every real-data release gate passes. Git,
development, Preview, staging, CI, screenshots, logs, support tools, recovery
rehearsals, and fixtures remain fictional-only. Owner authorization does not
replace security, corpus, backup, restore, monitoring, or release evidence.

## Prerequisites

- Exact commit and release record pass [`release-gates.md`](release-gates.md).
- Vercel project, Supabase project, region, environment variables and protection
  settings are verified.
- Candidate and qualification use fictional operational data only; the approved
  corpus version is pinned without copying controlled source content into Git or
  CI.
- Production migration, backup, observability and rollback evidence is current.
- Current and rollback deployments are compatible with the target database
  schema.
- Owner explicitly approves the named production candidate.

## Preview and staging-equivalent qualification

1. CI builds the exact commit and Vercel creates a Preview deployment.
2. Confirm Preview variables point only to non-production Supabase and AI
   resources.
3. Confirm Vercel Standard Protection is active for preview/generated URLs where
   available.
4. Run automated browser smoke, auth/RLS, accessibility, visual and print
   checks.
5. Designate one protected preview as the release candidate. Record its URL
   privately and immutable deployment identifier.
6. Apply the reviewed migration set to the non-production Supabase project only
   after local/CI replay passes.
7. Run the full staging-equivalent matrix, owner UX/AI review, backup test and
   rollback rehearsal.

Do not promote a generic pull-request preview directly merely because it
renders.

## Production deployment

The safest default is a backward-compatible database migration followed by
application promotion.

1. **MANUAL:** check Vercel, Supabase, DNS and AI-provider status pages.
2. **MANUAL:** record current production deployment, database migration head,
   corpus version, configuration version and baseline health.
3. **MANUAL/AUTOMATED:** create required pre-release database and Storage
   backups and verify manifests/checksums.
4. **AUTOMATED:** run the manual `Production database migration` workflow in
   `dry-run` mode for the exact candidate and review its value-free evidence.
5. **OWNER:** approve the exact migration output and Vercel deployment.
6. **AUTOMATED/MANUAL:** run the same protected workflow as a separate `apply`
   request, supplying the reviewed dry-run and verified database-plus-Storage
   backup references.
7. **MANUAL:** promote the qualified deployment to Vercel Production. Do not
   change DNS during a routine application release.
8. **AUTOMATED:** run read-only health plus authenticated fictional-account
   smoke tests for sign-in, role boundary, Home, policy retrieval/citations, and
   one non-persistent or cleanup-safe workflow.
9. **MANUAL:** watch error rate, latency, database connections/locks, Auth
   failures, Storage failures and AI failures/cost for at least 15 minutes and
   through the first representative use window.
10. **MANUAL:** complete the release record and communicate outcome.

For the AI fair-use migration, steps 6–7 are a declared AI-only maintenance
window: older application instances receive a fail-closed budget denial, not a
working identity-free fallback. Other site tools remain available. Rolling the
application back is data-safe but leaves AI unavailable until the
fair-use-capable application is restored.

Run `npm run release:verify -- --phase production --file <private-record>` only
after the full monitoring window. A passing result proves that the required
references are present and bound to one candidate; operators still have to
inspect the underlying provider, browser, security, backup, and approval
evidence. Keep the real record private and outside Git.

Production smoke must not create a real incident, real roster entry, or real
operational form. Use clearly reserved fictional qualification identities and
remove only the rows the smoke test owns.

## Rollback triggers

Restore service or disable the affected feature when any of these occurs:

- authentication or RLS permits unauthorized access;
- key officer/admin route or policy retrieval fails;
- unexpected real-data write or sensitive logging occurs;
- sustained 5xx/error rate exceeds the current approved threshold;
- latency or connection saturation makes core work unreliable;
- migration produces constraint, lock, integrity or data-loss symptoms;
- AI responses lose required citations, violate refusal/grounding rules, or
  materially exceed cost/latency limits;
- provider quota or plan restriction prevents safe operation.

Security or data-isolation failures trigger immediate containment; do not wait
for a percentage threshold.

## Application-only rollback

Use when the prior application is compatible with the current schema:

1. Confirm the incident and identify the last known-good production deployment.
2. Preserve logs, request IDs and release metadata without copying payloads.
3. Run Vercel Instant Rollback from the dashboard or authorized CLI.
4. Verify domains, rollback status, Auth, role boundaries and core routes.
5. Observe error/latency signals and record the outcome.
6. Remember that Vercel rollback does not restore database data or rebuild with
   new environment variables. Inspect environment compatibility explicitly.
7. After Vercel rollback, automatic production-domain assignment can remain
   disabled until a deployment is promoted; verify the project state before
   resuming normal releases.

Qualify rollback retention and controls on the selected plan before the live
hobby release. If the use stops being personal and non-commercial, recheck plan
eligibility before another deployment.

## Database or Storage recovery

If the schema or data is damaged:

1. Stop or feature-disable writes while preserving read access when safe.
2. Do not run an improvised destructive down migration.
3. Select the reviewed forward fix or restore procedure from the release record.
4. For restore, create a replacement Supabase project in the approved US region.
5. Restore and validate database, Auth-relevant state, private Storage objects,
   RLS and corpus checksums without exposing the project to users.
6. Update Vercel variables only after verification, rebuild a candidate, and
   obtain owner approval before traffic changes.

See [`backup-and-restore.md`](backup-and-restore.md).

## Configuration rollback

Environment-variable changes apply to new deployments, while an instant rollback
can retain or reintroduce build-time configuration associated with an older
deployment. Record configuration separately from code.

- Rotate a compromised key; never roll back to the compromised value.
- Restore a prior non-secret configuration through reviewed environment settings
  and a new deployment when needed.
- Confirm production and preview variables have not been crossed.
- Verify Supabase Auth redirect URLs, allowed origins and Storage policies after
  any domain/configuration change.

## Post-rollback

- Keep the incident open until service, authorization and data integrity are
  confirmed.
- Create a corrective pull request and fresh candidate; do not silently
  re-promote the failed build.
- Document root cause, detection gap, affected interval, data review, recovery
  evidence and prevention work.
- Re-enable normal Vercel production assignment only after an approved
  promotion.

References:
[Vercel production rollback](https://vercel.com/docs/deployments/rollback-production-deployment),
[Instant Rollback](https://vercel.com/docs/instant-rollback), and
[promoting deployments](https://vercel.com/docs/deployments/promoting-a-deployment).
