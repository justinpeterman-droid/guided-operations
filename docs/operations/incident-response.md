# Incident response

This runbook applies to the Guided Operations web application, Supabase project,
Vercel project, AI provider integration, and the approved policy/reference
corpus. It does not authorize putting real facility operations, personnel,
resident, incident, or case data into the product.

## Control labels

- **AUTOMATED** — a configured system can run the control and retain evidence.
- **MANUAL** — an engineer or responder must perform and record the control.
- **OWNER** — the product owner must approve the decision.
- **EXTERNAL** — a provider, facility authority, privacy/security reviewer, or
  other third party must act.

## Severity

| Severity | Examples                                                                                                                                                                                                                                                              | Initial response target                                                    |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| SEV-1    | Authentication or RLS bypass; exposed secret; private Storage object publicly accessible; confirmed or suspected real operational data in the system; destructive database event; policy corpus tampering that could produce unsafe guidance; broad production outage | Start immediately; notify the owner as soon as a safe channel is available |
| SEV-2    | Material feature outage; repeated incorrect or uncited RAG answers; failed backup/restore qualification; sustained provider errors; partial authorization failure with no known exposure                                                                              | Start promptly during the active support window                            |
| SEV-3    | Degraded performance, isolated defect, non-production failure, or low-risk alert with a working workaround                                                                                                                                                            | Triage in normal maintenance                                               |

These are operating targets, not proof that staffing or an on-call service
exists. Before production use, the owner must name a reachable incident lead and
an alternate.

## Roles

- **Incident commander (MANUAL):** owns severity, containment, decisions, and
  handoff.
- **Technical responder (MANUAL):** investigates and executes approved
  containment or recovery.
- **Scribe (MANUAL):** records a UTC timeline, evidence, decisions, and
  unresolved risks without copying sensitive payloads.
- **Owner (OWNER):** authorizes user-facing shutdowns, production
  restore/cutover, external notices, and return to service.
- **Provider/facility contacts (EXTERNAL):** handle provider incidents,
  legal/privacy review, and facility communications when applicable.

One person may fill several roles for a small team, but incident commander and
owner approvals must still be recorded separately when the decision is
owner-gated.

## First 15 minutes

1. **MANUAL:** Open an incident record with a unique ID, UTC start time,
   reporter, affected environment, and observable symptoms.
2. **MANUAL:** Classify the suspected impact: confidentiality, integrity,
   availability, authorization, corpus safety, or cost abuse.
3. **MANUAL:** Preserve relevant deployment IDs, request IDs, migration
   versions, corpus version, configuration version, and provider status links.
   Do not paste secrets, prompts, document text, or user-entered content into
   the incident record.
4. **MANUAL:** Stop further harm using the narrowest reversible control:
   - disable the affected application path or AI call;
   - revoke or rotate a compromised key;
   - remove a bad deployment from production;
   - make an affected Storage bucket inaccessible;
   - block writes while preserving reads, if the authorization model allows it.
5. **OWNER:** Approve a full production shutdown, destructive restore, user
   notification, or broad access revocation unless delay would materially
   increase a confirmed security exposure. Emergency action must be documented
   and reviewed afterward.

Never contain an incident by disabling authentication, weakening RLS, making a
bucket public, sharing a service key, or copying production data into an
uncontrolled system.

## Investigation

Record facts and hypotheses separately.

- Verify the exact Vercel deployment, Git commit, Supabase project reference,
  migration version, and corpus manifest.
- Check Vercel runtime/build logs, Supabase Auth/database/Storage logs, database
  advisors, and provider status pages.
- Reproduce in local or non-production with fictional fixtures whenever
  possible.
- For an authorization concern, test at least anonymous, ordinary authenticated,
  cross-user, privileged server, expired-session, and revoked-session paths.
- For an AI/corpus concern, preserve the query ID, retrieval metadata, citation
  identifiers, model/provider/version, and corpus version. Do not preserve raw
  document excerpts or prompts in ordinary telemetry.
- For suspected data exposure, identify what class of data was accessible, by
  whom, for how long, and from which control failure. Treat unknown scope
  conservatively.

## Containment playbooks

### Secret exposure

1. Revoke the credential at its provider.
2. Create a replacement with the minimum scope.
3. Update the appropriate Vercel/Supabase secret store; never commit it.
4. Redeploy only the affected environment.
5. Search Git history, CI logs, deployment logs, issue trackers, and incident
   notes for the exposed value or a recognizable prefix.
6. Review provider usage from the earliest plausible exposure time.

### Authentication, RLS, or Storage policy failure

1. Disable the affected route or operation without opening broader access.
2. Add a failing regression test that demonstrates the unauthorized path.
3. Fix database and Storage policies through a reviewed migration.
4. Qualify the fix in non-production using cross-user and anonymous tests.
5. Require owner authorization before restoring production access.

### Unsafe or corrupted RAG corpus

1. Disable affected corpus versions or AI answers; leave a clear unavailable
   state rather than guessing.
2. Pin the last qualified corpus manifest and retrieval configuration.
3. Verify provenance, checksums, effective dates, access classification, parsing
   output, and deletion/retention state.
4. Re-run the secure real-corpus evaluation suite.
5. Require owner approval for corpus promotion.

### Availability failure

1. Check provider status before changing the application.
2. If a new deployment caused the failure, follow
   [deployment-and-rollback.md](deployment-and-rollback.md).
3. If database or Storage state is damaged, follow
   [backup-and-restore.md](backup-and-restore.md).
4. Do not infer recovery from HTTP 200 alone; run authenticated browser,
   authorization, RAG citation, and fictional workflow smoke tests.

## Recovery and return to service

The incident commander records evidence for each applicable gate:

- **AUTOMATED:** required CI and security checks pass on the exact recovery
  commit.
- **MANUAL:** authenticated browser smoke tests pass with fictional data.
- **MANUAL:** RLS, Storage access, session revocation, and cross-user negative
  tests pass.
- **MANUAL:** the qualified corpus version returns grounded citations and
  refuses unsupported requests.
- **MANUAL:** restored database and Storage objects reconcile to the backup
  manifest.
- **EXTERNAL:** relevant Vercel, Supabase, AI-provider, DNS, or facility
  dependencies are healthy.
- **OWNER:** residual risk, notification decisions, and return to service are
  approved in writing.

Passing automated checks alone does not authorize return to service.

## Communications

- Use a private, owner-approved channel.
- State observable impact, affected environment, containment, next decision
  time, and known unknowns.
- Do not include credentials, raw prompts, document text, personnel identifiers,
  or real operational narratives.
- Only the owner or designated facility authority may make external statements.
- Any legally or contractually required notice is an **EXTERNAL/OWNER**
  decision; this runbook is not legal advice.

## After the incident

Within five business days of recovery:

1. Write a blameless timeline and root-cause analysis.
2. Record detection, containment, recovery, and decision delays.
3. Add regression tests and owners for corrective actions.
4. Review secret scope, RLS/Storage policies, log retention, backups, budget
   alarms, and provider configuration.
5. Decide whether the corpus or any derived index must be rebuilt.
6. Run an owner review and close only when residual risks are accepted.

Run a tabletop exercise before production and at least twice per year. Include
secret exposure, RLS bypass, corpus tampering, provider outage, and
database-plus-Storage restore scenarios.
