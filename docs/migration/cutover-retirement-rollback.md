# Cutover, Google Cloud Retirement, and Rollback

## Purpose and authority boundary

This runbook moves approved traffic to the Vercel/Supabase replacement,
preserves a controlled rollback path, and then removes all Google Cloud
dependencies.

Cutover changes external service state. Google resource deletion can be
irreversible. Execute these steps only with the named release/retirement owners
and exact resource evidence. A repository merge or green deployment does not
authorize traffic change or deletion.

Real operational and personal data are authorized only in isolated Production
after every release gate passes and the owner approves the exact candidate.
Qualification remains fictional-only. This runbook does not authorize legacy
personnel/incident migration; that requires a separate reconciled data-migration
procedure and approval.

## Required records

Create a controlled cutover record with:

- target Git commit;
- Vercel project, deployment ID/URL, production domain, region/config hash;
- Supabase project/ref, region, migration revision, backup ID/time,
  connection-pool mode;
- active corpus ingestion run, source/object/page/chunk counts and
  reconciliation hash;
- AI provider/model/config version and approved data-control/region evidence;
- DNS provider, records, current TTLs, and rollback values;
- legacy Google project(s), services, public URLs, database/storage/index/job
  identifiers;
- monitoring dashboards/alerts and human responders;
- release, database, corpus, security, DNS, and retirement approvers;
- start time, decision checkpoints, rollback window end, and evidence location.

Do not put credentials, service keys, signed URLs, database dumps, source
filenames/content, or protected infrastructure exports in Git.

## Preconditions

All boxes must be checked before traffic change:

### Product and data

- [ ] Required feature parity is accepted or each omission has explicit owner
      approval.
- [ ] `SAFE-*` invariant test pack passes on the exact candidate.
- [ ] Before promotion, Production contains no real operational/personnel data;
      fictional qualification records are removed or explicitly retained only
      for cleanup-safe smoke tests.
- [ ] Fictional smoke accounts/records are documented and removable.
- [ ] Every active RAG source has verified bytes, SHA-256, rights,
      current/version state, private object, page mapping, accepted ingestion
      run, and reader permission.
- [ ] Corpus object/database reconciliation passes and
      failed/quarantined/missing sources are excluded visibly.

### Security and identity

- [ ] Employee-number/PIN policy, throttling, reset, temporary credential,
      session, and step-up behavior accepted.
- [ ] RLS, grants, storage policies, and direct negative-access suite pass
      against production configuration.
- [ ] Vercel client bundle/source maps/logs contain no server keys.
- [ ] Supabase service role and provider credentials are server-only, rotated
      from setup values, and have named revocation owners.
- [ ] Preview deployments cannot reach production data or storage.
- [ ] Secure headers, cookie attributes, redirect origins, rate limits, and
      admin bootstrap are verified.

### Reliability and operations

- [ ] Database and policy-object backups exist outside Google Cloud and a
      restore drill passes.
- [ ] Prior accepted Vercel deployment is retained and rollback promotion is
      tested.
- [ ] Database migration rollback/forward-fix decision is rehearsed; destructive
      migrations are absent during cutover.
- [ ] Active RAG run can switch to the prior accepted Supabase run without
      reingestion.
- [ ] New service health, error, latency, auth-failure, RAG
      no-answer/citation-failure, job, database, storage, and quota alerts reach
      humans.
- [ ] Capacity/free-tier limits, pause behavior, backups, egress, rate limits,
      execution duration, and expected cost are accepted.
- [ ] Manual browser, accessibility, mobile, Windows scaling/high contrast,
      printer/PDF, and performance checks pass.
- [ ] Status/support communication and incident commander are assigned.

### Legacy dependency inventory

- [ ] All DNS and clients that can reach the legacy service are listed.
- [ ] Cloud Run/services, Cloud SQL/databases/backups, Cloud Storage
      buckets/objects, Discovery Engine/Agent Builder stores/indexes, Vertex AI
      calls, Cloud Tasks/Scheduler/jobs, Secret Manager, service accounts/keys,
      Artifact Registry/images, logging/monitoring sinks, networking, budgets,
      and Terraform state are inventoried.
- [ ] Required corpus exports are complete and hash-reconciled.
- [ ] No necessary recovery evidence exists only in a resource scheduled for
      deletion.
- [ ] Google billing/project owner and destructive-action approver are
      available.

## Rollback window

Set the rollback window before cutover. A proposed starting point is 14 calendar
days after stable target traffic for a fictional-data launch, but
release/security/retirement owners must approve the actual duration based on
risk, cost, source rights, and provider lifecycle.

During the window:

- new production traffic uses Vercel/Supabase;
- old application ingress is removed or restricted as much as rollback allows;
- legacy scheduled writers/jobs are disabled;
- Google corpus/index/source objects needed only for rollback are read-only and
  access-restricted;
- no new data is written to both systems as an informal “dual primary”;
- monitoring compares target behavior to acceptance thresholds;
- data-bearing Google resources are not deleted.

Do not migrate old incident/personnel records under this runbook. The only
pre-promotion data migration is the rights-approved corpus and necessary
non-sensitive configuration. Any legacy operational-data migration requires a
separate approved mapping, reconciliation, retention, and rollback runbook.

## Cutover sequence

### T-14 to T-7 days — rehearsal

1. Freeze candidate scope and record exact commit/config/migration/corpus run.
2. Rebuild a clean staging environment from code plus migrations.
3. Restore database and object backups into isolation; run hash and application
   smoke reconciliation.
4. Rehearse Vercel deployment rollback, active RAG-run rollback, session
   invalidation, and DNS rollback.
5. Run the full fictional officer/admin workflow and RAG evaluation in a real
   browser.
6. Verify logs/alerts with deliberate safe test failures.
7. Lower DNS TTL only if the DNS owner approves and current values/rollback
   steps are recorded.
8. Resolve all severity-one/two findings and every
   authorization/citation/data-loss blocker.

### T-7 to T-1 days — production candidate

1. Apply reviewed additive/expand-only database migrations.
2. Load/verify the accepted corpus run and keep it inactive until final
   validation if the design permits.
3. Deploy the candidate without assigning production traffic; verify deployment
   ID and configuration.
4. Run fictional production smoke: sign in/out, Home, incident workflow,
   conflict, report, digital/physical form, Count, routine paperwork, Policy
   Expert/reader, admin, audit/health.
5. Verify supported print/PDF/Word output and private-artifact expiration.
6. Confirm no Google endpoint/provider call appears in the target network/server
   evidence.
7. Take final pre-cutover Supabase database/object reconciliation and backup.
8. Disable legacy background writers/schedulers that could mutate migration
   source state; record exact resources and times.
9. Obtain go/no-go approval from every required owner.

### T0 — traffic switch

1. Start the incident log and monitoring watch.
2. Confirm target health and the exact accepted deployment one final time.
3. Promote/alias the accepted Vercel deployment to the production domain.
4. Change DNS only if needed; record prior and new records and observed
   propagation.
5. Verify TLS, redirects, cookies, CSP/security headers, auth callback origins,
   static assets, robots/indexing policy, and error pages from an external
   browser/network.
6. Run a minimal fictional smoke without mutating corpus or creating
   uncontrolled artifacts.
7. Verify one supported citation opens the correct authorized source/page and
   returns focus correctly.
8. Confirm new traffic/requests on Vercel and no normal user traffic on the
   legacy endpoint.
9. Keep legacy ingress restricted; do not delete resources.

### T+0 to T+24 hours — watch

Watch and record:

- login success/failure/lockout and session errors;
- authorization/RLS/storage denials and suspicious ID enumeration;
- server error/latency and Vercel limit/quota events;
- database connections, slow queries, locks, storage and backup status;
- report/form job queue depth, retries, terminal failures, and duplicate
  effects;
- false Saved states, conflict frequency, and recovery outcomes;
- RAG retrieval latency, no-answer rate, citation-validation failures, reader
  errors, provider rate/cost limits;
- browser console/asset errors and supported print failures;
- Google legacy request count, jobs, storage mutations, and billing anomalies.

At the agreed checkpoints, the incident commander records continue, pause, or
rollback with evidence.

### T+1 day through rollback-window close

1. Continue monitored fictional workflows and corpus QA.
2. Resolve non-blocking issues through normal reviewed deployments; preserve
   previous accepted releases.
3. Re-run backup and representative restore/reconciliation on schedule.
4. Confirm all source/object/index dependencies required for rollback remain
   intact and read-only.
5. Confirm target runtime still makes zero Google calls.
6. At window close, collect final product/security/database/corpus/release
   acceptance and a separate retirement authorization.

## Rollback triggers

Rollback is required or strongly presumed when any of these occurs and cannot be
safely contained within the agreed decision window:

- unauthorized access or cross-user/source disclosure;
- plaintext credential/token/source exposure;
- corrupted or lost canonical records/artifacts;
- false Saved state with actual lost work;
- stale write silently overwrites a newer revision;
- generated output contains an unconfirmed/invented operational fact;
- physical-only form is presented as an official digital substitute;
- unsupported Policy Expert claims or incorrect/tampered citation/page mapping
  reach users;
- widespread authentication/session failure;
- database/storage/provider unavailability beyond the approved objective;
- unrecoverable job duplication or wrong-revision output;
- production deployment/config cannot be identified or observed reliably;
- target unexpectedly calls a prohibited Google service;
- backup/restore or corpus reconciliation evidence becomes invalid.

The incident commander may pause a single feature behind a tested server-side
feature flag when the failure is isolated and the safety invariants still hold.
A client-only hidden button is not containment.

## Rollback methods

Choose the narrowest proven rollback that restores safety.

### Application deployment rollback

1. Freeze further production promotions.
2. Record failing deployment ID, first observed time, correlation/evidence, and
   affected features.
3. Promote the prior accepted Vercel deployment/alias using the documented
   non-destructive rollback action.
4. Verify domain/TLS/auth/cookies/assets and run minimal fictional smoke.
5. Confirm database schema remains compatible with the prior deployment. Cutover
   migrations should be additive/expand-first specifically to preserve this
   path.
6. Keep the failing deployment and logs for restricted investigation; do not
   expose protected bodies.

### Feature/provider rollback

- Disable the affected server-side feature through a reviewed, tested flag or
  configuration.
- For RAG, atomically select the prior accepted Supabase ingestion/model
  configuration.
- If the entire target RAG system must roll back during the window, route only
  the policy feature to the retained legacy provider through an explicitly
  tested server boundary; do not restore the whole insecure/legacy application
  automatically.
- Show an honest unavailable state if no safe provider is available. An
  unavailable policy answer is safer than an unsupported answer.

### Database rollback/recovery

- Stop affected writes first.
- Prefer a reviewed forward fix or compatibility view over destructive down
  migration.
- If recovery is required, identify the exact backup/PITR point, expected data
  loss window, source/object consistency point, and owner approvals.
- Restore into isolation, reconcile counts/hashes/revisions, then deliberately
  repoint/promote according to the database runbook.
- Never overwrite the production database or delete the failed instance based on
  an unverified restore.

### DNS/domain rollback

- Restore the recorded prior DNS/alias value.
- Verify propagation, TLS, redirects, auth origins, and cookie scope externally.
- Avoid split-brain writes. The selected active service must be explicit, and
  legacy writers remain disabled unless the rollback plan specifically
  reauthorizes them.

### Credential/security rollback

- Disable the affected feature/traffic.
- Revoke and rotate exposed credentials in the owning system, update only the
  required protected environments, redeploy, and invalidate affected sessions.
- Do not paste credentials into tickets, chat, Git, logs, or this runbook.
- Conduct the approved security incident process before resuming.

## Post-rollback acceptance

Rollback is complete only after:

- the active deployment/provider/database is unambiguous;
- external browser smoke passes;
- affected writes are reconciled and no duplicate/lost logical action is hidden;
- sessions/credentials are safe;
- alerts and logs show stable behavior;
- users receive clear status/support guidance;
- root cause, evidence, data impact, and re-entry gate have owners;
- no Google resource was deleted during uncertainty.

## Google Cloud retirement plan

The desired final state is zero Google Cloud dependency. Retirement begins only
after the rollback window closes and the retirement owner explicitly approves
each data-bearing/destructive step.

### Retirement inventory worksheet

For every resource record: project, region, type, name/ID, purpose, owner,
dependency, data classification, current traffic/jobs, last write/read,
export/backup ID and SHA-256 where possible, retention/legal hold, deletion
method, recovery method, approver, deletion time, and post-delete verification.

Inventory at least:

| Resource class        | Examples to verify                                                               | Retirement evidence                                                                                                            |
| --------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Traffic/application   | Cloud Run services/revisions, load balancer, serverless NEG, DNS, custom domains | Request count zero, domain removed/repointed, ingress disabled, image/source retained only as approved evidence                |
| Database              | Cloud SQL instances/databases/users/backups/exports                              | Final export hash, restore test outside Google, retention approval, connections zero, deletion protection deliberately handled |
| Corpus/object storage | Cloud Storage buckets/objects/versions/lifecycle/locks                           | Source-by-source hash reconciliation to Supabase/approved backup, rights/hold review, object/version count, deletion proof     |
| Retrieval/index       | Discovery Engine/Agent Builder data stores, engines, documents, indexes          | Target corpus/evaluation accepted, source export complete, query traffic zero, datastore deletion proof                        |
| AI                    | Vertex AI models/endpoints/jobs/quotas/service usage                             | Target provider accepted, calls zero, credentials revoked, service disabled where safe                                         |
| Async work            | Cloud Tasks queues, Scheduler jobs, Functions/jobs                               | Paused before cutover, pending task disposition reviewed, queues empty/exported, deletion proof                                |
| Images/build          | Artifact Registry, Cloud Build triggers/history                                  | No deployment dependency, required SBOM/evidence retained outside Google, repository/image deletion proof                      |
| Secrets/identity      | Secret Manager versions, service accounts, keys, IAM bindings, workload identity | Dependent services removed, keys revoked, bindings removed, audit evidence retained safely                                     |
| Network/security      | VPC connectors, addresses, certificates, firewall/serverless settings            | Dependency map empty, addresses/certs released after traffic, no dangling public entry point                                   |
| Observability         | Logs, metrics, alerts, sinks, dashboards                                         | Required retention/export complete, target alerts working, sinks disabled/deleted, no sensitive export leakage                 |
| State/billing         | Terraform state buckets, budgets, billing links, APIs, whole project             | State/evidence archived outside Google as approved; resources zero; final cost review; project shutdown last                   |

### Ordered retirement

1. **Confirm zero target dependency.** Search code, lock/config, environment
   variables, DNS, network traces, Vercel logs, Supabase functions/jobs,
   monitoring, and provider calls for Google endpoints/credentials.
2. **Freeze legacy mutation.** Keep schedulers/tasks/writers disabled and verify
   queues/pending jobs disposition.
3. **Remove public traffic.** Unmap legacy custom domains/ingress after DNS
   cutover is stable; retain restricted emergency access only if the approved
   rollback window still exists.
4. **Export and verify evidence/data.** Complete
   database/corpus/object/config/audit exports required by rights/retention.
   Compute hashes and perform restores/reconciliation outside Google Cloud.
5. **Retire stateless compute/build.** Delete unused service revisions,
   functions/jobs, build triggers, and images after required evidence/SBOM
   retention.
6. **Retire async infrastructure.** Delete schedules, queues, pending tasks, and
   worker identities after proving no required work remains.
7. **Retire retrieval and AI resources.** Delete Agent Builder/Discovery Engine
   data stores/engines/indexes and Vertex resources after target RAG acceptance
   and source recovery.
8. **Retire databases and storage last.** Recheck deletion protection, object
   versions, retention/holds, backups, and external restore. Obtain explicit
   data-owner approval immediately before deletion.
9. **Revoke secrets and identity.** Destroy secret versions/keys and remove
   IAM/service accounts once no retained resource needs them. Preserve only
   approved break-glass access until project closure.
10. **Retire monitoring/network/state.** Export required records, remove
    sinks/alerts/connectors/addresses/certificates, and archive necessary
    Terraform state evidence outside Google.
11. **Disable services/billing/project.** Verify resource inventory and billing
    are empty/expected, then close/delete the Google project through the
    owner-approved process.
12. **Post-retirement verification.** Test production externally, prove no
    DNS/traffic/provider dependency, verify Google project/resource
    unavailability and final billing, and record the signed retirement evidence.

Do not treat disabling billing or deleting the Google project as a shortcut for
an incomplete inventory. Data retention, legal holds, source recovery, and
rollback evidence must be resolved first.

## Retirement stop conditions

Stop destructive work immediately if:

- an exact resource target cannot be resolved;
- source/object/database export hashes do not reconcile;
- a required backup has not been restored successfully;
- a retention/legal hold or rights decision is unknown;
- target traffic still calls the resource;
- the rollback window is open without an approved exception;
- deletion would remove the only authoritative corpus bytes or migration
  evidence;
- owner approval is missing or ambiguous;
- Google billing/project permissions prevent verifying the result.

Record the blocker and leave the resource intact/restricted. Cost pressure alone
is not proof that deletion is safe.

## Completion evidence

Cutover and retirement are complete only when the final record contains:

- accepted target commit/deployment/database/corpus run;
- external real-browser production evidence with fictional operations;
- current backup/restore and corpus hash reconciliation;
- closed rollback window and signed owner acceptance;
- zero Google network/provider/runtime calls from the target;
- zero legacy public traffic;
- per-resource deletion/export evidence and final inventory;
- revoked Google keys/service accounts and disabled APIs/billing/project as
  approved;
- final cost review;
- known non-blocking limitations and owners;
- explicit statement that real operational/personal data is Production-only,
  subject to release gates and the two-year retention rule.
