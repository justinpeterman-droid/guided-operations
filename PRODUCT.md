# Guided Operations Product Contract

- **Document baseline:** 2026-08-25
- **Product:** Guided Operations
- **Repository:** `guided-operations` (private)
- **Deployment target:** Vercel + Supabase, United States region
- **Source reference:** `justinpeterman-droid/prison-policy-ai` at
  `ebe52c4b977ab742975974732beec42fff1bbce5`

**Use classification:** Private single-facility application. The owner has
authorized real operational and personal data in the isolated Production
environment only after release gates pass. Non-production remains fictional.

This document is the entry point for the replacement product. It records what
the product is, what it is not, which constraints are non-negotiable, and where
the detailed product and migration contracts live.

## Status truth

The new repository currently contains a Next.js foundation, Supabase
connection/migration scaffolding, a liveness route, shared visual tokens, a
tested pure Count Sheet calculation/schema slice, and a tested policy-answer
grounding schema. These are useful technical and contract foundations; they are
not accepted end-user feature parity. The hosted Supabase foundation now exists,
but there is still no complete migrated product route, production
authentication, application-to-Supabase environment linkage, migrated RAG
corpus, verified Vercel production deployment, or Google Cloud retirement.

Use these labels in plans, issues, pull requests, and documentation:

| Label                  | Meaning                                                                                                                                 |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| **FOUNDATION**         | Technical scaffolding exists in the new repository. It is not product parity.                                                           |
| **SOURCE-IMPLEMENTED** | The behavior exists in the canonical old repository and may be used as a migration reference. It is not implemented in this repository. |
| **SOURCE-PARTIAL**     | The old repository contains some UI or behavior, but known gaps prevent parity.                                                         |
| **BRANCH-ONLY**        | The work exists only on an unmerged or archived old-repository branch.                                                                  |
| **MIGRATION-BACKLOG**  | Required for this replacement, but not yet accepted in the new repository.                                                              |
| **PLANNED**            | Desired after the required migration or dependent on an owner decision.                                                                 |
| **OUT-OF-SCOPE**       | Intentionally excluded from this replacement.                                                                                           |

No document may describe a feature as “migrated,” “live,” “deployed,” or
“retired” without direct evidence for that specific state.

## Product promise

Guided Operations is a single-facility web workspace that helps correctional
staff complete policy-guided operational paperwork accurately. It organizes
incident facts, officer reports, required forms, routine paperwork, and cited
policy guidance without fabricating facts or replacing employee judgment.

The normal workflow is:

1. The employee identifies the involved and reporting officers.
2. The employee records field notes in their own words.
3. The system proposes structured facts and missing-information questions.
4. An authorized employee confirms, corrects, or leaves facts unknown.
5. The system creates editable draft reports and form guidance only from
   confirmed facts.
6. An authorized employee deliberately reviews, saves, prints, downloads,
   copies, or acknowledges each output.

AI assists with extraction, drafting, and retrieval. It never becomes the system
of record, silently decides an operational fact, or performs an official filing
action.

## Approved scope

- Private, web-only application; no desktop companion and no legacy Access
  workflow.
- One configured facility with no facility selector or multi-tenant
  administration in the first release.
- Employee-number and PIN-like sign-in experience.
- Two interactive authorization roles: officer and administrator.
- Officer incident workflow, document workspace, reports, forms, count sheet,
  account management, and cited policy guidance.
- Administrator incident oversight, paperwork, account/staff administration,
  audit visibility, and system health.
- Production may hold minimum-necessary authorized operational/personal records
  and approved policy/RAG source material after release qualification.
- Vercel for the web application and server runtime; Supabase for Postgres,
  authentication support, private object storage, and vector retrieval.
- Provider-neutral AI interfaces. OpenAI is acceptable as an initial provider,
  but domain code must not depend directly on one provider's response shape.
- United States regions for application data, storage, logs, and AI processing
  when the selected services support region choice.
- Vercel and Supabase plans must meet the required protection, recovery,
  retention, and capacity controls before real-data release. OpenAI remains
  usage-priced and provider data controls require approval.

## Current data authorization boundary

Real personnel, incident, resident, medical, evidence, account, and operational
records are authorized only in Production after the release gates pass.
Development, automated tests, screenshots, demonstrations, preview deployments,
logs, and seeded databases must use clearly fictional data.

The only permitted real source material is the existing policy/RAG corpus after
its provenance, access rights, retention, and processing rights are verified.
Corpus files are private content and are not committed to Git by default.

See
[`docs/operations/real-data-governance.md`](docs/operations/real-data-governance.md)
for the owner approval, two-year retention rule, and remaining release controls.

## Product principles

- **Review before output.** Proposed facts and generated text remain drafts
  until a person confirms them.
- **Unknown is valid.** Missing information stays visible; the product never
  fills a gap to make a packet appear complete.
- **One incident, one folder.** Facts, narratives, forms, actions, and history
  remain connected to one incident identity.
- **Clear next action.** Officer screens prioritize the next practical task;
  administrative density stays in administrator screens.
- **Visible trust.** The interface explains what was saved, what is unsaved,
  what source supports an answer, and what still needs attention.
- **Deliberate official actions.** Filing, printing, downloading, copying,
  closing, reopening, and acknowledging physical paperwork require an authorized
  employee action.
- **Least privilege.** UI hiding is not authorization. Server checks and
  Postgres row-level security enforce every protected operation.
- **Calm, accessible presentation.** Light navy-and-gold styling, restrained
  depth and motion, plain labels, strong focus states, responsive layouts, and
  honest empty/error states are part of the product contract.
- **Provider boundaries.** AI, object storage, and retrieval implementations
  remain replaceable behind tested interfaces.

The expanded rules are in [Product Principles](docs/product/principles.md) and
[Workflow and Report Safety](docs/product/workflow-and-report-safety.md).

## Target technical direction

Next.js is the selected React framework. It preserves the React component model
while providing first-class Vercel deployment, server-only boundaries, route
handlers, streaming where appropriate, and a straightforward path to Supabase
integration. The old Vite React SPA remains a useful design and behavior source;
its Flask-specific routing and API assumptions are not the target architecture.

The target boundary is:

- browser components for interactive forms and local UI state;
- Next.js server code for authorization, sensitive mutations, policy retrieval
  orchestration, document generation, and provider credentials;
- Supabase Auth or a tightly controlled server-side adapter for identity/session
  support;
- Supabase Postgres with row-level security, explicit grants, constraints, and
  indexed authorization keys;
- private Supabase Storage for authorized policy sources and generated
  artifacts;
- Postgres vector search for the initial provider-neutral RAG implementation;
- Vercel preview environments with fictional data only;
- no runtime, storage, queue, database, AI-retrieval, monitoring, or deployment
  dependency on Google Cloud at the end of migration.

## Documentation map

### Product contracts

- [Product Principles](docs/product/principles.md) — decisions that
  implementation may not weaken.
- [Roles and Permissions](docs/product/roles-and-permissions.md) — identity,
  role, and authorization matrix.
- [Feature Catalog and Parity](docs/product/feature-catalog-and-parity.md) —
  old-source behavior, target behavior, gaps, and acceptance.
- [Domain Glossary](docs/product/domain-glossary.md) — canonical terms for code,
  UX, schema, and tests.
- [Workflow and Report Safety](docs/product/workflow-and-report-safety.md) —
  anti-fabrication, revision, persistence, audit, and policy-answer invariants.

### Migration contracts

- [Source Manifest](docs/migration/source-manifest.md) — exact old-repository
  provenance and evidence.
- [Reuse, Rewrite, and Omit](docs/migration/reuse-rewrite-omit.md) — file-level
  migration decisions.
- [RAG Corpus Migration](docs/migration/rag-corpus-migration.md) — authorized
  source acquisition, hashing, page mapping, retrieval, and citation protocol.
- [Migration Plan](docs/migration/migration-plan.md) — phased implementation
  with gates and evidence.
- [Cutover, Retirement, and Rollback](docs/migration/cutover-retirement-rollback.md)
  — traffic change, rollback, and ordered Google Cloud retirement.

## Definition of replacement complete

The replacement is complete only when all of the following are true:

1. Every required feature in the parity catalog is accepted or has an
   owner-approved omission recorded in the repository.
2. Authentication, authorization, RLS, audit, revision, idempotency, and
   fictional-data tests pass against the deployed candidate.
3. The policy corpus has verified rights, SHA-256 source hashes,
   page-addressable extraction, validated citations, private storage, and tested
   restore procedures.
4. Supported desktop, tablet, mobile, keyboard, screen-reader, reduced-motion,
   print, and browser workflows have current evidence.
5. Vercel and Supabase live configuration, backups, monitoring, alert routing,
   region selection, and secrets have named owners.
6. A controlled cutover is completed with rollback evidence and owner
   acceptance.
7. Google Cloud runtime traffic is zero, required exports are verified outside
   Google Cloud, and every Google resource is retired through the approved
   destructive-action checklist.
8. The repository, deployment, migration, invited-officer evaluation, and
   retirement gates are each recorded separately. Passing one gate does not
   imply the others passed. Any future official pilot is an additional gate.
