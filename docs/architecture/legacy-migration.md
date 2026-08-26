# Legacy Migration and Reconciliation

**Status:** Planning baseline; hosted foundation with no legacy data import

## Source baseline

The architecture audit used the former prison-policy-ai repository's origin/main
commit ebe52c4b977ab742975974732beec42fff1bbce5 as the planning baseline.
Recheck that repository before importing because paths and live external state
can change.

The new repository is not a blind copy. Preserve verified product behavior, pure
domain logic, contracts, fictional fixtures, and useful UI. Replace provider
coupling, legacy surfaces, deployment assumptions, and secrets.

## Current foundation versus target

| Area       | Current new repository                                                                                 | Target                                                                       |
| ---------- | ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| Web        | Next.js 16/React 19 scaffold, honest static preview, health route                                      | Full operational workspace in App Router                                     |
| API        | Health route and server/client factories only                                                          | Same-origin /api/web/v1 BFF                                                  |
| Auth       | Disabled-signup local config; no qualified login flow                                                  | Supabase Auth with proposed employee-number bridge                           |
| Database   | Initial locked `app_private` policy/account/corpus foundation applied to hosted Supabase; tables empty | Complete private schema, narrow grants/RPCs, RLS policies, records, and jobs |
| Storage    | Two private buckets created; no objects or object workflows                                            | Qualified private Supabase buckets and policies                              |
| AI/RAG     | Grounded-policy domain/schema foundation; no live provider or retrieval path                           | Provider-neutral adapters, OpenAI initial, pgvector hybrid search            |
| Jobs       | None                                                                                                   | Durable database job/outbox plus Supabase Queues                             |
| Worker     | None                                                                                                   | Conditional non-Google worker                                                |
| Deployment | Protected Vercel preview plus hosted Supabase foundation; app linkage and preview verification open    | Protected Vercel + Supabase environments                                     |

No target control may be marked complete based on old repository code alone.

## Capability disposition

### Preserve and port

- Guided Operations React workspace features and practical UI patterns.
- Incident/report schemas, reviewed facts, gap answers, validation, and
  warnings.
- Immutable incident/report revision semantics.
- Owner/preparer/admin authorization behavior.
- Idempotency, optimistic concurrency, stale-base handling, and restore-as-new.
- Form/packet, physical paperwork acknowledgment, operational utility, print,
  and action-history rules.
- Deterministic prompt assembly, structured extraction schemas, gap detection,
  validation, provenance, citation normalization, and no-invention safeguards.
- Deterministic DOCX behavior and fidelity fixtures.
- OpenAPI behavior, contract/security/integration tests, fictional fixtures, and
  sensitive-output scanner.

Port provider-neutral TypeScript/domain logic first. Retain Python document/OCR
logic only behind ADR-0005 when doing so reduces fidelity risk.

### Replace

- Flask/Gunicorn web/API hosting with Next.js Route Handlers and server DAL.
- SQLAlchemy request-path persistence with reviewed Supabase access patterns.
  Alembic may remain as a read-only reference during schema translation.
- Cloud SQL with Supabase PostgreSQL.
- GCS with private Supabase Storage.
- Cloud Tasks with database outbox plus Supabase Queues.
- Vertex/Discovery Engine/Agent Builder with OpenAI adapters plus PostgreSQL
  full-text/pgvector retrieval.
- Cloud Run API/worker/jobs with Vercel and the conditional non-Google worker.
- Google Secret Manager with environment-scoped Vercel/worker/Supabase secret
  management.
- Cloud Monitoring with Vercel/Supabase telemetry and an approved alerting sink.
- Google Terraform, WIF, Artifact Registry, load balancer/Armor/DNS/certificate,
  Workflows/Scheduler, and GCP backup resources with target provider controls.

### Retire

- Shared ACCESS_CODE/ADMIN_CODE behavior.
- Legacy Flask/Jinja pages and Review Lab handoff unless a current product
  requirement explicitly revives it.
- Microsoft Access bearer API in this web-only product.
- Firebase/GitHub Pages/Google deployment and rollback workflows.
- All Google SDK/runtime dependencies in target web/worker packages.

## Data migration rule

Real operational/personal data is authorized only in isolated Production after
the release gates pass. Therefore:

- do not copy legacy staff, account, session, incident, report, form instance,
  audit, job, export, or paperwork rows into any non-production environment;
- use fictional seed builders and data-classification tests;
- migrate legacy operational data only through a separately approved Production
  mapping, validation, retention, backup/restore, rollback, and cutover plan;
- continue to migrate approved policy/reference corpus objects only with their
  necessary source/version/provenance metadata.

Auth identities for actual users are security metadata created through the new
bootstrap/account workflow, never copied from a legacy JSON roster or chat.

## Corpus migration is a hard prerequisite

The legacy Git tree did not contain a complete authoritative corpus. Before any
Google resources are decommissioned:

1. Identify the authoritative original PDFs/reference objects and owner.
2. Export original bytes, OCR/derived text where needed, source metadata,
   versions, page mappings, checksums, and ingest state.
3. Reconcile documented/upload-list counts and record discrepancies.
4. Verify rights and approved data handling.
5. Import originals to private `policy-sources` objects through the new
   quarantine flow.
6. Re-extract/chunk/embed under the target versioned pipeline.
7. Run citation/retrieval evaluation and page-level spot checks.
8. Record count/hash/source reconciliation.
9. Retain the source export and rollback copy until target backup/restore and an
   observation window pass.

Do not treat generated embeddings alone as a corpus backup.

## Schema translation

1. Write a target logical catalog from [data-model.md](data-model.md).
2. Create clean forward Supabase migrations for extensions, schemas, roles,
   tables, constraints, indexes, functions, triggers, grants, RLS, Storage
   policies, queues, and seed guards.
3. Apply from zero in CI on the selected PostgreSQL version.
4. Verify schema catalog and migration head.
5. Run behavior parity tests against fictional scenarios, not a row-for-row
   import.
6. Load only approved corpus metadata/objects through application ingest.

Required extensions are validated, not assumed: pgcrypto or equivalent UUID/
crypto functions, vector, pgmq/Queues, and any scheduling/observability
extension actually used.

## Additive paperwork reconciliation

The former migration history created two pairs:

- paperwork_records / paperwork_revisions, used by the known ORM/domain path;
- operational_paperwork / operational_paperwork_revisions, created by a later
  migration and referenced by migration verification.

Target canonical names are `app_private.paperwork_records` and
`app_private.paperwork_revisions`.

If no operational rows are being imported, create only the canonical target pair
and keep this decision as historical evidence.

If a legacy database ever becomes an approved import source:

1. Do not edit, delete, reorder, or squash the legacy migration files.
2. Take a verified backup and run a read-only inventory of both pairs.
3. Compare schemas, constraints, counts, IDs, parents, current-head continuity,
   revision numbers, timestamps, and canonical row hashes.
4. Stop for owner review on collisions, divergent content, or orphans.
5. Add a new reconciliation migration after the old head. It creates/fills the
   canonical pair and records provenance/conflicts; it does not overwrite
   existing canonical rows.
6. Validate counts, hashes, FKs, uniqueness, and current revision pointers.
7. Switch reads/writes to canonical tables and make duplicates read-only.
8. Observe through a rollback window.
9. Drop/archive duplicates only in a later approved forward migration with fresh
   backup and reconciliation evidence.

This is an additive reconciliation item, never an excuse to make migration
checks green by erasing history.

## Contract migration

- Start from the old web OpenAPI surface as an inventory, then publish a clean
  target openapi/web-v1.yaml.
- Preserve stable success/error semantics only for product requirements still in
  scope.
- Write contract tests before replacing each implementation group.
- Do not expose old provider fields, Cloud URLs, internal aliases, or database
  shapes in the target contract.
- Retire the Access API explicitly rather than leaving an unauthenticated
  compatibility route.

## Phased implementation

### Phase 0: Guardrails

- Accept/propose ADRs, SECURITY.md, data-classification rule, and API inventory.
- Decide ADR-0003 auth details and ADR-0005 qualification method.
- Define fictional seed/test strategy and prohibited-content scan.

### Phase 1: Platform foundation

- Create local Supabase config and clean migrations.
- Establish schemas, grants/RLS test harness, Auth SSR boundary, DAL pattern,
  error/CSRF/idempotency primitives, and environment validation.

### Phase 2: Identity and workspace

- Implement/qualify employee login, account lifecycle, sessions, admin step-up,
  Home, staff DTOs, and account/security tests.

### Phase 3: Records and utilities

- Port incidents, reports, immutable history, forms/packets, paperwork, print,
  export metadata, and admin record workflows with contract parity.

### Phase 4: Corpus and AI

- Export/reconcile approved corpus.
- Implement private ingest, page-aware chunks, pgvector/FTS retrieval, OpenAI
  adapters, citations, evaluations, and report assistance.

### Phase 5: Durable work

- Implement job/outbox/Queues.
- Measure workloads and either qualify Vercel execution or activate one
  non-Google worker.

### Phase 6: Release qualification

- Protected preview/staging, restore test, security/RLS matrix, accessibility,
  real-browser flows, provider-limit/cost evidence, production approvals, and
  final Google-resource decommission plan.

## Google decommission gate

No Google-hosted resource is part of the target. Decommissioning the old
environment is a separate destructive operation and occurs only after:

- authoritative corpus export and hash reconciliation;
- target ingest/retrieval/citation acceptance;
- target database and Storage backups plus restore test;
- identity/bootstrap and all critical browser flows qualified;
- queue/worker and deterministic exports qualified;
- DNS/domain ownership and rollback plan approved;
- observation window complete;
- explicit owner authorization for the named Google resources.

Do not copy Google credentials, Terraform state, secrets, personnel data, logs,
or build artifacts into this repository.
