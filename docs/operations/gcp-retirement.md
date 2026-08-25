# Google Cloud retirement gates

The target architecture uses Vercel and Supabase and has no Google-hosted
application component. This document is a retirement plan, not evidence that
Google Cloud resources have been inventoried, migrated, disabled, or deleted.

No destructive Google Cloud action is authorized by this file. Disabling
traffic, revoking credentials, deleting data/resources/projects, closing
billing, or changing DNS requires explicit owner approval and any applicable
facility or provider approval.

## Scope inventory

Before cutover, create an owner-reviewed inventory for every project, folder,
organization, billing account, region, and external integration associated with
the old product. Check at minimum:

- Cloud Run, App Engine, Firebase Hosting/Functions/Auth, GKE, Compute Engine;
- Cloud SQL, Firestore, BigQuery, Memorystore, and database backups;
- Cloud Storage buckets, object versions, lifecycle rules, signed URLs, and
  retention locks;
- Vertex AI, Agent Builder/Discovery Engine/Data Store/Search, indexes,
  embeddings, evaluation data, and API keys;
- Artifact Registry/Container Registry, Cloud Build, deploy triggers, source
  repositories, and images;
- Cloud Tasks, Scheduler, Pub/Sub, Workflows, Eventarc, queues, and dead-letter
  data;
- Secret Manager, KMS, certificates, OAuth clients, service accounts, IAM
  bindings, workload identity, and federated GitHub credentials;
- Cloud Logging, Monitoring, Error Reporting, audit-log exports, alert
  destinations, and retention;
- DNS zones/records, domains, load balancers, CDN, Armor, NAT, VPC, firewall
  rules, static IPs, and egress;
- Terraform state, state locks, CI variables, local application-default
  credentials, gcloud configurations, and runbooks;
- Marketplace subscriptions, support plans, budgets, credits, quotas, billing
  exports, and third-party callbacks.

For each item record project ID, resource ID, owner, purpose, environment, data
classification, dependency, monthly cost, retention requirement, replacement,
cutover state, rollback dependency, and deletion approval.

## Allowed migration content

The only approved real content for the new application is the owner-approved
policy/reference corpus and its required provenance metadata. Exporting or
moving real incidents, personnel data, resident data, operational counts, search
logs, prompts, model responses, or access histories into the new product is
prohibited.

Allowed artifacts still require review:

- approved source policy/reference files and rights/provenance metadata;
- schema and migration concepts reimplemented for Supabase;
- fictional fixtures, templates, design assets, and provider-neutral application
  logic;
- retrieval evaluation cases that contain no operational or personal data;
- configuration names and documented behavior, never secret values.

Do not copy Google service-account keys, API keys, tokens, connection strings,
encrypted secret blobs, generated embeddings of unapproved content, or Terraform
state into the new repository.

## Exit gates before traffic cutover

| Gate               | Control                    | Evidence                                                                                    |
| ------------------ | -------------------------- | ------------------------------------------------------------------------------------------- |
| Inventory complete | MANUAL + OWNER             | Signed inventory with no unknown billed or traffic-serving dependency                       |
| Data boundary      | MANUAL + OWNER/EXTERNAL    | Corpus approval, provenance, checksums, rights, and proof that prohibited data was excluded |
| Functional parity  | AUTOMATED + MANUAL         | Required workflows pass with fictional fixtures                                             |
| Auth/RLS/Storage   | AUTOMATED + MANUAL         | Anonymous, cross-user, privileged, revoked-session, and private-object tests                |
| RAG parity         | AUTOMATED + MANUAL + OWNER | Retrieval/citation/refusal evaluations on the approved corpus                               |
| Recovery           | MANUAL + OWNER             | Successful isolated restore of Supabase database and Storage                                |
| Operations         | MANUAL + OWNER             | Alerts tested, incident contacts named, cost/plan limits accepted                           |
| Infrastructure     | EXTERNAL + MANUAL          | Vercel/Supabase/DNS/AI-provider accounts and regions verified                               |
| Release            | OWNER                      | Exact production deployment, migration, and corpus versions authorized                      |

Passing code checks does not authorize cutover.

## Cutover

1. Freeze old-system schema/content changes and record the freeze time.
2. Take and verify required old-system exports and audit evidence.
3. Ingest only the approved corpus through the new controlled pipeline.
4. Qualify the exact Vercel deployment, Supabase migrations, Storage objects,
   and corpus manifest.
5. Lower DNS TTL in advance if DNS is in scope.
6. Obtain written owner cutover authorization.
7. Change traffic once; do not run unreviewed dual writes between Google and
   Supabase.
8. Run authenticated browser, RLS/Storage, RAG-citation, fictional workflow,
   print, and monitoring smoke checks.
9. Keep the old system read-only or traffic-disabled for the approved rollback
   window. Record all access.

Rollback must have an explicit decision point, DNS/app procedure, database
compatibility statement, and owner. Never copy new operational content back to
the old system; real operational data is not allowed in either migration
direction under this plan.

## Decommission sequence

After the rollback window and written owner approval:

1. disable inbound traffic and scheduled/queued execution;
2. verify no DNS, webhook, CI, identity, backup, or monitoring consumer remains;
3. retain required audit evidence and approved corpus exports under the
   owner-approved retention policy;
4. revoke service-account keys, API keys, OAuth clients, workload identity, and
   cross-cloud CI access;
5. remove secrets from Google Secret Manager only after all replacement
   credentials are verified;
6. delete AI indexes/data stores and application resources in dependency order;
7. delete object/database data only after backup-retention and legal/contractual
   gates are satisfied;
8. remove DNS/networking and release static resources;
9. remove Terraform state and state storage only after the inventory and
   destruction evidence are preserved;
10. disable APIs, remove IAM, and close billing/project last.

Each material deletion needs the resource ID, timestamp, actor, owner approval,
verification query, and recovery status. If deletion is irreversible, state that
explicitly before approval.

## Completion evidence

Google Cloud retirement is complete only when:

- the inventory has zero unexplained traffic, credentials, resources, scheduled
  work, or charges;
- provider billing and audit views confirm the expected state through at least
  one full billing cycle;
- DNS, webhooks, CI, local configs, and documentation no longer target Google;
- retained evidence and corpus artifacts are accessible under the approved
  retention policy;
- Vercel/Supabase recovery has been reverified after final credential
  revocation;
- the owner signs the retirement record.

Until then, describe the state as “retirement in progress,” not “off Google
Cloud.”
