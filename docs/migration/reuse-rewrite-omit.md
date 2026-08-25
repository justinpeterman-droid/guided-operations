# Reuse, Rewrite, and Omit Inventory

## Decision standard

Migration is behavior-led, not folder-led. Copying is appropriate only when code
is provider-neutral, free of real/sensitive fixtures, compatible with the
Next.js runtime, and still matches the product contract.

Each imported unit must receive one decision:

- **REUSE** — copy with small import/style/test adaptations.
- **ADAPT** — preserve substantial logic or presentation but replace integration
  boundaries.
- **REWRITE** — use old behavior/tests as a specification and implement a new
  target-native unit.
- **REFERENCE ONLY** — retain as historical design/evidence; do not import
  runtime code.
- **OMIT** — intentionally excluded from the replacement.
- **QUARANTINE** — do not import until privacy, rights, version, or content
  review passes.

No item below is already migrated merely because it is marked REUSE or ADAPT.

## High-confidence reusable logic

| Old path                                                                         | Decision        | Why                                         | Import acceptance                                                                                                        |
| -------------------------------------------------------------------------------- | --------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `frontend/web/src/features/paperwork/count-sheet/calculations.ts`                | **REUSE**       | Pure calculation logic with focused tests   | Confirm approved source formulas/order; port tests; add blank-vs-zero, bounds, and mismatch cases.                       |
| `frontend/web/src/features/paperwork/count-sheet/schema.ts`, `types.ts`          | **ADAPT**       | Useful domain shape                         | Replace client/API assumptions; validate against new DB/domain schemas and current approved form.                        |
| `frontend/web/src/features/administration/paperwork/*/model.ts`                  | **ADAPT**       | Encodes daily-form models and calculations  | Validate every field/default/source; remove old API shapes; add version field and server schema.                         |
| `frontend/web/src/features/administration/paperwork/schemas.ts`                  | **ADAPT**       | Useful client validation reference          | Make one canonical server/domain schema and derive client types; avoid duplicated validators.                            |
| `frontend/web/src/features/administration/paperwork/shared/saveStateForError.ts` | **REUSE/ADAPT** | Preserves truthful error-to-state semantics | Map new typed errors; prove network/conflict/terminal states do not claim success.                                       |
| `frontend/web/src/components/persistenceStatus.ts`                               | **REUSE/ADAPT** | Accepted shared save vocabulary             | Move to shared UI/domain error contract; preserve exact safety semantics.                                                |
| `frontend/web/src/print/PrintDocument.tsx`, `PrintPacket.tsx`, `print.css`       | **ADAPT**       | Useful print composition patterns           | Convert routing/build assumptions; validate real forms, pagination, fonts, source order, browser/printer/PDF outputs.    |
| `frontend/web/src/design-system/Primitives.tsx`                                  | **ADAPT**       | Strong accessible control/surface patterns  | Integrate with the new styling strategy, React 19/Next boundaries, server/client split, and current accessibility tests. |
| `frontend/web/src/components/InterfaceIcon.tsx`                                  | **REUSE/ADAPT** | Typed current-color SVG icon contract       | Consolidate to one icon system, validate names/labels/tree shaking, and remove unused legacy glyphs.                     |

Pure logic is not automatically correct because tests pass. Product/source-owner
review remains required for operational rules and forms.

## React feature code to adapt

| Old path                                                         | Decision           | Preserve                                                                                    | Replace                                                                                                                                       |
| ---------------------------------------------------------------- | ------------------ | ------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `frontend/web/src/features/dashboard/**`                         | **ADAPT**          | Home hierarchy, authorized-data states, four actions, Quick Access, calm scenic composition | React Router links, old API client, Vite assets, legacy session profile, any hard-coded provider/status assumptions.                          |
| `frontend/web/src/features/incidents/NewReportPage.tsx`          | **ADAPT/REFACTOR** | Six-step interaction, review-first copy, visible save state                                 | One-file orchestration, client-only state machine, current-officer assumption, free-text category, hard-coded questions, old job polling/API. |
| `frontend/web/src/features/incidents/ReportsPage.tsx`            | **ADAPT**          | List hierarchy and honest states                                                            | Old endpoints/query shape; add server authorization, safe pagination/filter metadata.                                                         |
| `frontend/web/src/features/incidents/DocumentStudioPage.tsx`     | **ADAPT/REFACTOR** | Six tabs, attribution, copy-only behavior, physical guidance, history                       | Monolithic component, old API, generic form sheet, missing add-form flow, direct browser print/download assumptions.                          |
| `frontend/web/src/features/policy/PolicyExpertPage.tsx`          | **ADAPT**          | Question/answer/citation UX, no-answer/error states                                         | Google-backed endpoint shape, weak citation assumptions, old route manifest, client orchestration.                                            |
| `frontend/web/src/features/forms-library/**`                     | **ADAPT**          | Search/filter/capability language and physical-only distinction                             | Planning-only actions, incomplete rendering/download, old API.                                                                                |
| `frontend/web/src/features/paperwork/count-sheet/*.tsx`, `*.css` | **ADAPT**          | Data-entry/validation/print hierarchy                                                       | API/session assumptions; confirm source fidelity and new persistence model.                                                                   |
| `frontend/web/src/features/account/**`                           | **ADAPT**          | Own profile/PIN/session UX and accessible status                                            | Legacy employee/shared-code authentication endpoints and CSRF client.                                                                         |
| `frontend/web/src/features/administration/overview/**`           | **ADAPT**          | Command-center hierarchy and honest dependency states                                       | Old aggregation endpoint; fabricated/default metrics prohibited.                                                                              |
| `frontend/web/src/features/administration/incidents/**`          | **ADAPT**          | Attribution banner, oversight layout, confirmations                                         | Flask endpoint contracts; implement new transition/step-up/revision policies.                                                                 |
| `frontend/web/src/features/administration/paperwork/**`          | **ADAPT**          | Daily editors, monthly prints, revision panel, save-state UX                                | API client and autosave hooks; validate forms and implement server transaction/idempotency.                                                   |
| `frontend/web/src/features/administration/accounts/**`           | **ADAPT**          | Profile/account separation and security-sensitive dialogs                                   | Legacy auth/admin endpoint; use Supabase/server identity adapter and explicit step-up.                                                        |
| `frontend/web/src/features/administration/audit/**`, `health/**` | **ADAPT**          | Information hierarchy and state labels                                                      | Google/Flask observability contracts; new redacted Vercel/Supabase/provider health model.                                                     |

Break large legacy pages into feature-owned server/domain functions and focused
client components. Do not convert an entire old page into a Next.js client
component simply to make it render.

## Styles and assets

| Old path                                                                | Decision                  | Conditions                                                                                                                                                   |
| ----------------------------------------------------------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Feature CSS under `frontend/web/src/features/**`                        | **ADAPT**                 | Extract semantic tokens and intentional feature rules; remove import-order patches, dormant selectors, Vite path assumptions, and duplicated control styles. |
| `frontend/web/src/assets/operations-horizon-v4*.webp`                   | **QUARANTINE then ADAPT** | Verify generation/source rights, privacy review, metadata, dimensions, compression, and responsive usage. Keep Home-only.                                    |
| `frontend/web/src/assets/sidebar-mountains-v3.webp`                     | **QUARANTINE then ADAPT** | Same asset review; ensure narrow layouts do not download unnecessary large assets.                                                                           |
| `frontend/web/public/operations-horizon.svg`                            | **QUARANTINE then ADAPT** | Confirm source and rights; scan embedded metadata/scripts/external references.                                                                               |
| Legacy shield/crystal images and video under `backend/webapp/static/**` | **OMIT by default**       | They belong to an older visual direction and add licensing/performance risk. Import only after a new explicit visual decision.                               |
| Fonts under `backend/webapp/static/fonts/**`                            | **QUARANTINE**            | Verify license and whether self-hosting is needed. Prefer a documented, minimal font strategy.                                                               |

Do not copy the supplied reference screenshot or any real identity/operational
imagery into the new repo or deployment.

## Tests as migration specifications

| Old path                                                                    | Decision                     | Use                                                                                                                                                                 |
| --------------------------------------------------------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Co-located `*.test.ts` and `*.test.tsx` under `frontend/web/src/**`         | **ADAPT**                    | Preserve behavior, accessibility, calculations, save/conflict, authorization presentation, and error-state cases. Update the harness and add server/RLS tests.      |
| `frontend/web/tests/e2e/*.spec.ts`                                          | **ADAPT**                    | Convert route/base URL and fixture setup; retain officer/admin, responsive, accessibility, print, and authorization scenarios.                                      |
| `frontend/web/tests/e2e/visual-regression.spec.ts` and 48 Windows snapshots | **REFERENCE ONLY initially** | Use to compare intentional design, not to force identical pixels across the new framework. Establish reviewed new baselines; never bulk-update to hide regressions. |
| Legacy Flask/unit tests for domain behavior                                 | **REFERENCE ONLY/TRANSLATE** | Extract invariants and cases; do not preserve Python just to reuse the tests.                                                                                       |
| Full-reader branch tests                                                    | **TRANSLATE**                | Preserve opaque ID, allowlist, route traversal, highlight/fallback, and focus/scroll requirements in Next.js/browser tests.                                         |

Add target-native tests that the old suite could not provide: Supabase
RLS/direct API denial, storage policies, migration constraints/indexes, provider
contract fixtures, server/client secret boundary, and Vercel preview
fictional-data behavior.

## Templates and definitions

| Old path                                                                 | Decision                      | Conditions                                                                                                                                                              |
| ------------------------------------------------------------------------ | ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `templates/incident_checklist_v2.json`                                   | **QUARANTINE then ADAPT**     | Validate schema, source authority, version, categories/questions, privacy, and operational owner approval.                                                              |
| `templates/disciplinary_charges.json`                                    | **QUARANTINE then ADAPT**     | Treat as controlled reference data; verify authority/current version and prevent AI from deciding a charge.                                                             |
| `templates/paperwork/catalog.json`                                       | **ADAPT**                     | Convert to versioned database/domain definitions; verify every source, capability, and rights statement.                                                                |
| `templates/paperwork/count_sheet.json`, `daily/*.json`, `monthly/*.json` | **QUARANTINE then ADAPT**     | Validate against authorized source forms, field order, defaults, validation, print contract, and revision.                                                              |
| `templates/paperwork/weekly/catalog.json`                                | **REFERENCE ONLY**            | It is empty. Preserve the no-invention decision, not a fake weekly feature.                                                                                             |
| `templates/005_template_v3.docx`                                         | **QUARANTINE**                | Binary inspection, rights/current-revision approval, malware scan, mapping/print comparison, and storage decision required. Do not serve from public Git/static assets. |
| `templates/report_style_guide.md`                                        | **ADAPT**                     | Convert safe writing rules into versioned generation instructions and tests; remove provider-specific prompt assumptions.                                               |
| `templates/staff_roster.json`, `templates/demo_notes.json`               | **OMIT by default**           | Create new explicitly fictional fixtures; never assume legacy names/details are safe.                                                                                   |
| `templates/gold_reports/**`                                              | **QUARANTINE/REFERENCE ONLY** | May contain realistic or source-derived narrative. Review rights/privacy before using even in evaluation. Prefer new fictional gold cases.                              |

## Backend contracts to rewrite

| Old path                                                            | Decision                                   | Target replacement                                                                                                                                     |
| ------------------------------------------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `frontend/web/src/api/client.ts`                                    | **REWRITE**                                | Typed Next.js server action/route-handler client, standardized error envelope, request correlation, idempotency, and no global Flask CSRF assumptions. |
| All feature `api.ts` files                                          | **REWRITE around shared domain contracts** | Generated/inferred types from canonical schemas; server authorization and validation; safe caching rules.                                              |
| `frontend/web/src/features/auth/AuthProvider.tsx` and `auth/api.ts` | **REWRITE**                                | Server-verified Supabase/session adapter, secure cookies, employee-number mapping, PIN lifecycle, session revocation.                                  |
| `backend/webapp/web_api/**`, `backend/webapp/api_v1/**`             | **REWRITE**                                | Next.js server/domain services plus Supabase/Postgres policies; retain only reviewed behavior contracts.                                               |
| Legacy persistence/repository code                                  | **REWRITE**                                | Supabase migrations with constraints, indexed foreign keys/RLS predicates, revision/idempotency tables, and explicit transaction boundaries.           |
| Document generation code                                            | **REWRITE/ADAPT by formatter**             | Server-only generators, private artifacts, version/hash provenance, queue/outbox when duration exceeds request limits.                                 |

Do not expose the Supabase service role key in browser code. Browser-readable
Supabase access still requires RLS; sensitive mutations should pass through
server-only authorization/business rules even when RLS also protects the table.

## RAG code to rewrite

| Old path                                        | Decision                         | Target replacement                                                                                                                                         |
| ----------------------------------------------- | -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `backend/pipeline/extract.py`, `chunk.py`       | **REFERENCE/ADAPT ALGORITHMS**   | Deterministic page-aware extractor/chunker with SHA-256, extraction version, OCR confidence, stable chunk IDs, and QA state.                               |
| `backend/pipeline/embed.py`                     | **REWRITE**                      | Provider interface, explicit embedding model/version/dimension, batch/retry contract, pgvector persistence.                                                |
| `backend/pipeline/retrieval.py`, `query.py`     | **REWRITE**                      | Supabase/Postgres retrieval plus provider-neutral answer orchestration; no Discovery Engine/Vertex dependency.                                             |
| `backend/pipeline/citations.py`                 | **REWRITE with selective tests** | Strict claim-to-stored-passage validation and page mapping. Do not accept lexical fallback as authoritative citation without an explicit product decision. |
| `backend/pipeline/import_to_agent_builder.py`   | **OMIT from runtime**            | One-time legacy inventory/export knowledge only; final system has no Agent Builder dependency.                                                             |
| OCR scripts and `scripts/ocr_progress.json`     | **REFERENCE ONLY**               | Build a reproducible ingestion pipeline with immutable runs, source hashes, structured results, and safe logs.                                             |
| Full-reader branch backend/static/template code | **REWRITE**                      | Next.js authorized reader/API with private storage and opaque IDs.                                                                                         |

See [RAG Corpus Migration](rag-corpus-migration.md) for the required target
contract.

## Infrastructure and deployment to omit

The following must not enter the target runtime or deployment path:

- `infra/terraform/**`
- `.github/workflows/terraform-plan.yml`
- `.github/workflows/terraform-apply.yml`
- `docs/runbooks/guided-web-gcp-launch.md`
- Google Cloud Run, Cloud SQL, Cloud Storage, Cloud Tasks, Secret Manager,
  Identity-Aware Proxy, Artifact Registry, Vertex AI, Discovery Engine/Agent
  Builder, and GCP monitoring assumptions
- `Dockerfile` behavior whose purpose is to bundle Flask and the built Vite SPA
  for Cloud Run
- generated Flask static bundles such as `backend/webapp/static/web/**`

Keep GCP-specific material only in the legacy repository and the controlled
retirement evidence. Do not delete the old resources until the cutover/rollback
requirements are met.

## Legacy web surfaces to omit

- `backend/webapp/templates/**` and `backend/webapp/static/js/**` as runtime UI.
- `/workspace` BrowserRouter basename and Flask static asset publishing.
- `/access-handoff`, Access shared-code launch, desktop companion delivery, and
  legacy Review Lab launch.
- Old home/roster/chat pages when equivalent product behavior is implemented in
  the new Next.js app.
- Dormant/unused React components and stylesheet overrides identified only by
  historical designs.

If browser-native Review Lab functionality is desired later, specify it as a new
web feature with its own roles, data, workflow, and safety acceptance. Do not
preserve the legacy handoff as an undocumented compatibility path.

## Never copy

- Secrets, `.env` files, provider keys, service-account files, cookies, session
  stores, credentials, Terraform state, database URLs, or signed URLs.
- Real personnel/roster, incident, inmate, medical, evidence, or historical
  operational data.
- Logs, traces, screenshots, videos, database dumps, browser profiles, caches,
  generated build directories, or local temporary files.
- The dirty old working tree or files selected solely because they are newer
  locally.
- RAG source bytes into Git without explicit rights/security approval and a
  documented exception.
- Old readiness claims, environment names, resource identifiers, health values,
  or screenshots as evidence for the replacement.

## Per-file migration checklist

Before merging any legacy-derived file:

- [ ] Old commit and exact path recorded.
- [ ] Decision is REUSE, ADAPT, REWRITE, REFERENCE ONLY, OMIT, or QUARANTINE.
- [ ] License/rights and asset metadata reviewed.
- [ ] Secret, real-data, and sensitive-path scan passed.
- [ ] Flask, `/workspace`, Google, provider, filesystem, and public-object
      assumptions removed or intentionally isolated.
- [ ] React Server/Client Component boundary is deliberate.
- [ ] Server authorization, RLS, validation, revision, and idempotency
      responsibilities are clear.
- [ ] Loading/empty/error/offline/conflict/session-expired behavior exists.
- [ ] Accessibility and responsive behavior tested.
- [ ] New target-native unit/integration/browser tests pass.
- [ ] No historical “ready/live/passed” statement was carried forward without
      new evidence.
