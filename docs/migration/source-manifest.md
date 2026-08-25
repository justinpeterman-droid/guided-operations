# Legacy Source Manifest

## Purpose

This manifest fixes the provenance of the old code and content used to plan the
replacement. It prevents a dirty checkout, stale local branch, unmerged
experiment, or generated artifact from becoming an accidental source of truth.

This document records verified Git evidence. It does not assert that a source is
legally reusable, secure, production-ready, or already copied into this
repository.

## Canonical baseline

| Item                              | Verified value                                                 | Migration rule                                                                      |
| --------------------------------- | -------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Legacy repository                 | `https://github.com/justinpeterman-droid/prison-policy-ai`     | Read-only migration source. Do not add as the new production remote.                |
| Canonical reference               | `origin/main`                                                  | Fetch and resolve the exact commit before extracting files.                         |
| Canonical commit                  | `ebe52c4b977ab742975974732beec42fff1bbce5`                     | Pin this SHA in migration PRs that copy/reference old behavior.                     |
| Canonical frontend subtree        | `frontend/web` tree `3e608322435379f694b723619f13b8838dd02cbc` | Primary modern React behavior/design source.                                        |
| Audit date                        | 2026-08-25                                                     | Re-audit only if the owner intentionally selects a newer source commit.             |
| Local checkout state during audit | Local `main` was 56 commits behind `origin/main` and dirty     | Never copy from the working tree by default. Read blobs from the pinned Git commit. |

Reproduce the critical identifiers without checking out a branch:

```powershell
git fetch origin --prune
git rev-parse origin/main
git rev-parse 'origin/main:frontend/web'
git show 'origin/main:frontend/web/src/App.tsx'
```

Expected values for this baseline are the canonical commit and frontend tree
shown above. If they differ, stop and record a new owner-approved source
baseline rather than silently updating this document.

## Audited feature refs

| Ref                                          | Commit                                     | Relationship to canonical source                                                                   | Decision                                                                            |
| -------------------------------------------- | ------------------------------------------ | -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `origin/main`                                | `ebe52c4b977ab742975974732beec42fff1bbce5` | Canonical baseline                                                                                 | Use.                                                                                |
| `origin/codex/react-web-finish`              | `fcdf65c34969107283891d0792524e01439866fe` | Its `frontend/web` tree is byte-identical to canonical `origin/main`                               | Do not cherry-pick or recopy; canonical already contains it.                        |
| local `codex/react-web-finish`               | `3df07df3801c630982cf78f8a5a7547734a8e2b7` | Stale local ref                                                                                    | Ignore.                                                                             |
| `origin/codex/guided-home-visual-completion` | `fbdf60a3e4961fdfe6a8b90826aa7688f12941a7` | Earlier Home visual work superseded by canonical Home                                              | Use only for historical explanation if needed; do not make it the UI source.        |
| `origin/feat/daily-paperwork-center`         | `960944ae3abfe6acd2adfb4b5f4fdeba8f645944` | Feature tree is represented by squash merge commit `8021820`; audited content is in canonical main | Use canonical files; do not cherry-pick the branch.                                 |
| `feat/full-policy-reader`                    | `c5e49c809674750e6be36ae1b042222a6d2ce3cd` | Unmerged, approximately 280 commits behind with 10 unique commits at audit                         | Design/behavior input only. Port selectively into the new architecture.             |
| `archive/full-policy-reader-2026-08-09`      | `c5e49c809674750e6be36ae1b042222a6d2ce3cd` | Local archival tag for the same branch tip                                                         | Preserve the SHA in documentation; do not require the local ref to exist elsewhere. |

The full-policy reader exception is explicit because it is not present in
canonical `origin/main`. The branch adds/changes legacy
Flask/Jinja/vanilla-JavaScript reader code and tests, including:

- `backend/pipeline/policy_catalog.py`
- `backend/pipeline/policy_store.py`
- `backend/pipeline/citations.py`
- `backend/pipeline/retrieval.py`
- `backend/webapp/routes/chat.py`
- `backend/webapp/static/js/policy-reader.js`
- `backend/webapp/templates/chat.html`
- `docs/superpowers/plans/2026-08-09-full-policy-reader.md`
- `tests/js/policy-reader.test.cjs`
- `tests/unit/test_policy_catalog.py`
- `tests/unit/test_policy_routes.py`
- `tests/unit/test_policy_store.py`

These files demonstrate intended behavior such as opaque policy IDs, allowlisted
sources, passage highlighting, full text/PDF fallback, and focus/scroll
restoration. They are not a Next.js/Supabase implementation and must not be
merged wholesale.

## Canonical React product source

The primary source area is `frontend/web` at the pinned tree. The audit counted
242 files, including 169 source files, 98 TSX files, 24 CSS files, 46
component/API unit-test files, 11 Playwright E2E specs, and 48 Windows visual
snapshots. Counts document audit scope; they are not a mandate to copy every
file.

High-value source groups:

| Source path                                                                | What it establishes                                                                                                     |
| -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `frontend/web/src/App.tsx`                                                 | Canonical officer/admin route map and authorization presentation.                                                       |
| `frontend/web/src/features/auth/**`                                        | Employee-number sign-in UX, session state, and failure-copy reference.                                                  |
| `frontend/web/src/features/dashboard/**`                                   | Data-driven officer Home and accepted Home-specific presentation.                                                       |
| `frontend/web/src/features/incidents/**`                                   | Six-step incident workflow, Reports, Document Studio, packet/report actions, persistence and conflict UX.               |
| `frontend/web/src/features/policy/**`                                      | Policy Expert question, answer, citation, source, and error-state behavior.                                             |
| `frontend/web/src/features/forms-library/**`                               | Catalog/filter/capability and packet-selection behavior.                                                                |
| `frontend/web/src/features/paperwork/count-sheet/**`                       | Count model, calculations, screen workflow, and print layout.                                                           |
| `frontend/web/src/features/administration/**`                              | Admin gate/layout, overview, incidents, routine paperwork, staff/accounts, audit, health, and legacy Review Lab launch. |
| `frontend/web/src/features/account/**`                                     | Own credential/session management UX.                                                                                   |
| `frontend/web/src/design-system/Primitives.tsx`                            | Shared accessible control/surface/field contract.                                                                       |
| `frontend/web/src/components/InterfaceIcon.tsx`                            | Typed accessible operational icon set.                                                                                  |
| `frontend/web/src/components/persistenceStatus.ts`                         | Shared truthful persistence vocabulary and error mapping.                                                               |
| `frontend/web/src/print/**`                                                | Screen-to-print document/packet primitives and registry.                                                                |
| `frontend/web/src/assets/**`, `frontend/web/public/operations-horizon.svg` | Accepted fictional scenic direction; rights and metadata review still required.                                         |
| `frontend/web/tests/e2e/**`                                                | Behavioral, authorization, accessibility, responsive, print, and visual-regression contracts.                           |

Important design and operational references in canonical main:

- `docs/superpowers/specs/2026-08-18-guided-operations-web-frontend-design.md`
- `docs/design/guided-operations/officer-utilities.md`
- `docs/design/guided-operations/sanitized-paperwork-structures.md`
- `docs/design/guided-operations/site-wide-visual-polish-checklist.md`
- `docs/design/guided-operations/visual-accessibility-evidence.md`
- `docs/design/guided-operations/visual-asset-register.md`
- `docs/design/guided-operations/visual-decision-log.md`
- `docs/design/guided-operations/visual-performance-budget.md`
- `docs/superpowers/plans/2026-08-18-guided-operations-web-program-roadmap.md`
- `docs/user-guides/guided-operations-officer-quick-start.md`
- `docs/user-guides/guided-operations-admin-quick-start.md`

Treat dated evidence as historical evidence tied to its old commit/environment.
Do not copy statements such as “passed,” “production,” or “ready” into the new
repository without rerunning the corresponding gate.

## Form and report-definition sources

Potentially reusable definitions include:

- `templates/incident_checklist_v2.json` — Git blob
  `d27f38035f8d3e6f919937620605f39419226c71`, 30,680 bytes.
- `templates/disciplinary_charges.json` — Git blob
  `da1d58750d4f23737335fdb8f0cf9ad6722859fa`, 13,453 bytes.
- `templates/paperwork/catalog.json`
- `templates/paperwork/count_sheet.json`
- `templates/paperwork/daily/*.json`
- `templates/paperwork/monthly/*.json`
- `templates/paperwork/weekly/catalog.json` — deliberately empty at the
  baseline.
- `templates/report_style_guide.md`
- `templates/005_template_v3.docx`

These definitions require schema validation, operational-owner review,
source/revision verification, rights review, and fictional-data scanning before
import. A filename such as “official,” a template in Git, or old test coverage
does not by itself prove current approval or legal reuse.

Do not copy `templates/staff_roster.json`, `templates/demo_notes.json`,
workbooks, screenshots, or generated outputs until their contents are inspected
and confirmed fictional/non-identifying. Prefer newly generated fictional
fixtures.

## RAG source evidence in canonical main

| Evidence                                                                                                                           | Verified observation                                                                                                                                     | Limitation                                                                                                                                                                        |
| ---------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `rag_uploaded_pdfs.txt`                                                                                                            | Git blob `b93bdc97c63d298d3d24a8a073872db726d38734`; 13,292 bytes; 297 total lines; 292 non-comment entries; 292 unique entries; all names end in `.pdf` | A filename manifest does not prove source bytes, current versions, page counts, rights, or successful ingestion. Do not copy the full filename list into the new repo by default. |
| `backend/webapp/static/NCU_Operational_Training_Manual.pdf`                                                                        | Git blob `7beee956a05a39ba62de372b390cf991c3eff84f`; 148,032 bytes; the only verified tracked PDF-like corpus file found in the audited source tree      | Git presence does not prove current authorization or that this is the authoritative revision. Quarantine until rights/version/hash review.                                        |
| `backend/pipeline/{extract,chunk,embed,retrieval,query,citations}.py`                                                              | Shows legacy extraction/retrieval/citation flow                                                                                                          | Provider and application coupling require rewrite.                                                                                                                                |
| `backend/pipeline/import_to_agent_builder.py`                                                                                      | Shows legacy Google Agent Builder import path                                                                                                            | Omit from the target runtime. May inform inventory recovery only.                                                                                                                 |
| `scripts/ocr_pipeline.py`, `scripts/ocr_policies.py`, `scripts/chunk_ocr.py`, `scripts/ocr_manual.py`, `scripts/ocr_progress.json` | Shows prior OCR work and state                                                                                                                           | Progress metadata is not proof of source integrity or quality; inspect for sensitive paths/content before any transfer.                                                           |

The Git object format in the audited repository is SHA-1. The blob IDs above are
Git provenance identifiers, not the required corpus SHA-256 content hashes. The
new ingestion process must compute SHA-256 directly from every acquired source
byte stream and derived page/chunk record.

The audit did not verify that the other 291 PDF source objects are stored in
Git. Their authoritative bytes must be exported from the current controlled
source location before Google Cloud retirement. Missing source bytes are a
migration blocker, not permission to reconstruct policy from embeddings or
answer excerpts.

## Legacy backend and provider sources

The following are behavior references but not target-runtime code:

- `backend/webapp/web_api/**` and `backend/webapp/api_v1/**` — Flask routes,
  cookie/CSRF middleware, and domain API behavior.
- `backend/pipeline/query.py` and `backend/pipeline/retrieval.py` — Google
  Discovery Engine/Agent Builder and Gemini contracts.
- `backend/pipeline/citations.py` — inline marker parsing and cited-passage
  selection; includes lexical fallback that needs explicit reconsideration
  because inferred citations are weaker than verified claim-to-passage mapping.
- `backend/webapp/templates/**` and `backend/webapp/static/js/**` — legacy
  Jinja/vanilla JavaScript surfaces.
- `infra/terraform/**`, `.github/workflows/terraform-*.yml`, and
  `docs/runbooks/guided-web-gcp-launch.md` — Google Cloud infrastructure to
  exclude from the new runtime and later retire safely.

The old API description is incomplete relative to live routes. Derive the new
API/domain contracts from product behavior and safety invariants, then test
them; do not mechanically translate an incomplete OpenAPI file.

## Safe extraction procedure

For each selected source file:

1. Record the old repository commit and exact path in the migration pull
   request.
2. Read the file from `git show <sha>:<path>` or an archive created from the
   pinned commit, not from the dirty working tree.
3. Classify it as reuse, rewrite, reference-only, or omit using
   [Reuse, Rewrite, and Omit](reuse-rewrite-omit.md).
4. Scan for credentials, endpoints, employee/personnel data, operational
   records, real source content, generated artifacts, and third-party licensing
   restrictions.
5. Remove Flask, `/workspace`, Google, and provider assumptions at the boundary
   rather than hiding them behind renamed variables.
6. Add new-repository tests for the intended contract before declaring parity.
7. Record significant divergence and its product/security rationale.

Never import `.env` files, local configuration, cloud state, service-account
material, database dumps, logs, traces, browser profiles, generated static
bundles, or unreviewed binary sources.

## Evidence that remains unverified

- The authoritative storage location and complete byte inventory for the 292
  named PDF sources.
- Rights to store, process, embed, quote, display, and migrate each policy
  source.
- Which source revisions are current or superseded.
- Page-number conventions and OCR quality for each source.
- Whether the tracked NCU manual is current and authorized for the target
  service providers.
- Whether old generated form binaries match current official forms.
- Whether any local-only dirty changes contain desired product work.

These are explicit discovery tasks. They must not be resolved by assumption.
