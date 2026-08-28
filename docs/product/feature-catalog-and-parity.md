# Feature Catalog and Parity Matrix

## How to read this catalog

This catalog compares the canonical old source with the intended replacement.
The source snapshot is `justinpeterman-droid/prison-policy-ai` `origin/main` at
`ebe52c4b977ab742975974732beec42fff1bbce5`; branch-only exceptions are named
explicitly.

At the 2026-08-25 documentation baseline, the new repository had a
Next.js/Supabase foundation, a tested pure Count Sheet calculation/schema slice,
and a tested policy-answer grounding schema, but no accepted complete migrated
product feature. The original baseline state remains in the parity matrix for
traceability. The current implementation snapshot below supersedes only that
state column; it does not claim end-to-end parity or production readiness.

“Source-implemented” means the old source is a behavior/design reference. It
does not mean that old code is safe to copy unchanged, that its backend contract
is complete, or that the new product has parity.

## Current implementation snapshot — 2026-08-26

| Surface                         | Current replacement state                                                                                                                                                                                                                                                                                         | Still required for parity                                                                                                                                 |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sign in and sessions            | Guarded employee-number/passcode route, generic failures, layered rate limits, current-session checks, forced/personal passcode changes, logout and logout-all are implemented.                                                                                                                                   | Hosted fictional cookie rotation/expiry, timing, recovery absence, revoked-session, direct-access, and browser proof.                                     |
| Officer shell and Home          | Protected `/home` presents equal report and Policy Expert actions, direct Forms/Count Sheet/history routes, and up to two server-authorized report summaries. Empty or unavailable work remains explicit; it never substitutes training work. Denied/unavailable and officer/admin entry states remain protected. | Complete responsive/accessibility/signed-in-browser qualification, loading/retry behavior, and owner acceptance.                                          |
| Incident and report workflow    | Protected `/incidents/new`, `/reports`, report draft review/finalization, append-only revisions, history, restore, search, and stale-revision-guarded browser print auditing exist.                                                                                                                               | Full six-step parity, officer/preparer relationships, confirmed-fact/gap flow, supported export, concurrency/browser proof.                               |
| Forms and packets               | Protected `/forms` honestly exposes only the reviewed Count Sheet and keeps unapproved Daily/Monthly work unavailable; the fictional visual Preview remains separate.                                                                                                                                             | Approved sources, searchable capability catalog, packet workflows, persistence, fidelity, print/export, records disposition, and signed-in browser proof. |
| NCU Days Count                  | Exact reviewed structure, protected assigned-shift load/save/reopen/revision review/append-only restore, stale-write response, database form enforcement, redacted print-request audit, and fictional Chromium calculation proof exist.                                                                           | Conflict recovery acceptance, one-page print/export fidelity, accessibility breadth, hosted proof, and owner acceptance.                                  |
| Policy Expert                   | Protected `/policy-expert`, server-only OpenAI/retrieval adapters, citation validation, refusal behavior, strict endpoint boundaries, and immutable ingestion provenance exist.                                                                                                                                   | Authoritative corpus migration, rights/hash/page reconciliation, reader route, golden evaluation, hosted proof, acceptance.                               |
| Account                         | Protected `/account` supports temporary/personal passcode changes and current/all-session sign-out controls.                                                                                                                                                                                                      | Hosted real-cookie lifecycle, session inventory if required, reauthentication/browser proof, and acceptance.                                              |
| Administrator entry             | Protected `/admin` enforces current administrator role on the server and links bounded administrator sections.                                                                                                                                                                                                    | Complete facility command center, incident/paperwork administration, responsive/browser proof, and acceptance.                                            |
| Accounts and staff              | Protected `/admin/accounts` supports invitation with approved shift assignment, roster shift visibility/change, reset, unlock, disablement, and role change with purpose-bound step-up, session revocation, lifecycle guards, and redacted audit metadata.                                                        | Hosted Auth/revocation proof, fictional administrator browser flow, credential-delivery procedure, responsive/accessibility qualification, acceptance.    |
| Audit and system health         | Protected `/admin/audit` and `/admin/health`, strict runtime readiness, and allowlisted sign-in/policy/report operational events exist.                                                                                                                                                                           | Hosted sinks/access/retention, remaining signals, dashboards, alerts, test delivery, budgets, and observation.                                            |
| Retention and legal hold        | Archived operational heads receive a database-derived 730-day review date. Protected `/admin/retention` placement/release uses separate purpose-bound step-up, same-facility target validation, an immutable register, and bounded audit evidence without a cleanup path.                                         | Complete records schedule, Storage/backup reconciliation, controlled deletion, browser/hosted rehearsal, and owner approval.                              |
| Backup and recovery             | Automated local fictional PostgreSQL archive restore plus private Storage copy/checksum reconciliation passes with bounded evidence and verified cleanup.                                                                                                                                                         | Encrypted off-provider hosted jobs and isolated replacement-project restore with RPO/RTO, Auth/corpus, and checksum proof.                                |
| Help, full policy reader, forms | No protected parity implementation exists.                                                                                                                                                                                                                                                                        | Implement only from approved contracts and source material; keep physical-only and unsupported actions honest.                                            |

Passing tests or having a route does not make a row complete. Each row still
needs the applicable cross-cutting gates at the end of this document.

## Route and surface parity

The old React SPA was mounted below `/workspace`. The target URLs remove that
Flask/Vite basename and use Next.js routes directly.

| Product surface          | Canonical old route/source state                                                                           | Proposed target URL               | 2026-08-25 baseline state                     | Required parity and known source gaps                                                                                                                                                                                                                                                                                                                                                                                                          |
| ------------------------ | ---------------------------------------------------------------------------------------------------------- | --------------------------------- | --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sign in                  | `/workspace` login; **SOURCE-IMPLEMENTED**                                                                 | `/login`                          | **MIGRATION-BACKLOG**                         | Employee number + PIN-like secret, generic failures, throttling/lockout, session rotation, temporary-credential flow, fictional accounts only. Rebuild the backend/session contract for Supabase; do not port cookie/CSRF assumptions blindly.                                                                                                                                                                                                 |
| Shared shell/navigation  | `frontend/web/src/App.tsx`; **SOURCE-IMPLEMENTED**                                                         | authenticated layout              | **MIGRATION-BACKLOG**                         | Preserve small officer navigation, separate admin entry, responsive drawer/rail, focus restoration, truthful connection/save state, and no `/workspace` base.                                                                                                                                                                                                                                                                                  |
| Officer Home             | `/workspace/`; **SOURCE-IMPLEMENTED**                                                                      | `/`                               | **MIGRATION-BACKLOG**                         | Data-driven greeting and work summary, four primary actions, NCU Count shortcut, Quick Access, honest loading/empty/error states, calm Home-only scenic assets. No invented incidents, counts, identity, notifications, health, quote, or “last synced” value.                                                                                                                                                                                 |
| New Report               | `/workspace/new-report`; **SOURCE-IMPLEMENTED with gaps**                                                  | `/new-report`                     | **MIGRATION-BACKLOG**                         | Six-step workflow: Officers, Field Notes, Review Facts, Missing Information, Reports, Forms & Export. Replace source gaps: current-officer-only assumptions, free-text category, hard-coded missing questions, and incomplete autosave/concurrency coverage.                                                                                                                                                                                   |
| Reports list             | `/workspace/reports`; **SOURCE-IMPLEMENTED**                                                               | `/reports`                        | **MIGRATION-BACKLOG**                         | Authorized incidents only, useful filters/search, calculated workflow progress, real loading/empty/error states, no data leak through count or filter metadata.                                                                                                                                                                                                                                                                                |
| Document Studio          | `/workspace/reports/:incidentId`; **SOURCE-IMPLEMENTED with gaps**                                         | `/reports/[incidentId]`           | **MIGRATION-BACKLOG**                         | Preserve tabs: Overview, Officer Reports, Copy to Records, Required Paperwork, Notes & Facts, History. Require revision-safe edits, attribution, packet source/capability visibility, paper-accurate previews, supported downloads, and add-form workflow. Old generic key/value preview is not form parity.                                                                                                                                   |
| Forms & Export step      | New Report step 6; **SOURCE-PARTIAL**                                                                      | within `/new-report` and incident | **MIGRATION-BACKLOG**                         | Show required/suggested/additional/physical-only items, completeness, source version, and deliberate preview/print/download/copy actions. Do not claim an export exists until a real artifact is generated and checked.                                                                                                                                                                                                                        |
| Forms Library            | `/workspace/forms`; **SOURCE-PARTIAL**                                                                     | `/forms`                          | **PROTECTED FOUNDATION; MIGRATION-BACKLOG**   | Protected catalog foundation exposes only reviewed availability and physical-only guidance. Add search/filter, capabilities, source/revision, multi-select packet preview, and authorized add-to-incident as approved forms arrive. Old source does not prove complete document rendering.                                                                                                                                                     |
| NCU Days Count           | `/workspace/count-sheet`; **SOURCE-IMPLEMENTED**                                                           | `/count-sheet`                    | **PROTECTED SLICE; MIGRATION-BACKLOG**        | Exact source order, browser entry, reconciliation, dated shift-shared records, append-only save/history/restore, stale-revision print guard, redacted deliberate-output audit, blank-vs-zero rules, and keyboard/mobile qualification exist. Complete one-page export fidelity, broader accessibility, hosted proof, and acceptance.                                                                                                           |
| Policy Expert            | `/workspace/policy-expert`; **SOURCE-IMPLEMENTED with legacy provider**                                    | `/policy-expert`                  | **FOUNDATION schema only; MIGRATION-BACKLOG** | The new repo has a strict grounded-answer/citation schema and tests, not retrieval or a page. Add authorized question, retrieved evidence, verified supporting excerpts, citation cards, no persistence of question/answer/excerpts in ordinary history, clear unavailable/no-source outcome, and provider-neutral orchestration. Replace Google Discovery Engine/Gemini dependencies.                                                         |
| Full Policy Reader       | Not on canonical `origin/main`; **BRANCH-ONLY** at `c5e49c809674750e6be36ae1b042222a6d2ce3cd`              | `/policies/[policyId]`            | **MIGRATION-BACKLOG**                         | Build from the branch design, not by copying Flask/Jinja/vanilla JS. Use opaque IDs, authorization, page-addressable full text/PDF, citation highlight, PDF fallback, focus/scroll restoration, and private signed access.                                                                                                                                                                                                                     |
| Help                     | `/workspace/help`; **SOURCE-IMPLEMENTED, minimal**                                                         | `/help`                           | **MIGRATION-BACKLOG**                         | Plain workflow help, safety boundaries, citation limitations, save/conflict recovery, support path, versioned content owner. No sensitive environment details.                                                                                                                                                                                                                                                                                 |
| Account                  | `/workspace/account`; **SOURCE-IMPLEMENTED**                                                               | `/account`                        | **MIGRATION-BACKLOG**                         | Own profile, PIN change, session list/revoke, precise loading/failure announcements, reauthentication, and no disclosure of tokens or other users.                                                                                                                                                                                                                                                                                             |
| Admin entry and layout   | `/workspace/admin/*`; **SOURCE-IMPLEMENTED**                                                               | `/admin/*`                        | **MIGRATION-BACKLOG**                         | Server-enforced administrator role, intentional entry, step-up policy, responsive admin navigation, no reliance on client route guards.                                                                                                                                                                                                                                                                                                        |
| Admin Overview           | `/workspace/admin/overview`; **SOURCE-IMPLEMENTED**                                                        | `/admin/overview`                 | **MIGRATION-BACKLOG**                         | Facility-wide actionable summary backed by authorized queries; every count has loading/empty/error semantics. No decorative or fabricated operational metrics.                                                                                                                                                                                                                                                                                 |
| Admin Incidents          | `/workspace/admin/incidents`; **SOURCE-IMPLEMENTED**                                                       | `/admin/incidents`                | **MIGRATION-BACKLOG**                         | Authorized facility-wide search/filter and incident entry. Pagination, filter counts, exports, and empty states must not leak hidden data.                                                                                                                                                                                                                                                                                                     |
| Admin Incident Workspace | `/workspace/admin/incidents/:incidentId`; **SOURCE-IMPLEMENTED**                                           | `/admin/incidents/[incidentId]`   | **MIGRATION-BACKLOG**                         | Preserve original officer attribution, show administrator attribution banner, require elevation for sensitive mutations, validate state transitions, revision conflicts, idempotency, and append-only history.                                                                                                                                                                                                                                 |
| Daily Paperwork          | Admin Paperwork Center; **SOURCE-IMPLEMENTED**                                                             | `/admin/paperwork/daily`          | **FOUNDATION-IMPLEMENTED; EDITORS OPEN**      | Administrator-only date/shift selection, the six-type catalog, private append-only source/version registry, exact template binding, backup-freeze coverage, and negative access tests exist locally. No private source body is committed. Approved source import, all six editors, save/history/restore, optimistic conflict recovery, source-order print, responsive/accessibility proof, hosted migration, and owner acceptance remain open. |
| Weekly Paperwork         | Empty source catalog; **SOURCE-PARTIAL/PLACEHOLDER**                                                       | `/admin/paperwork/weekly`         | **PLANNED, BLOCKED ON APPROVED TEMPLATES**    | Canonical `templates/paperwork/weekly/catalog.json` contains no templates. Do not invent weekly forms. Implement an honest empty/not-configured state until an approved source and owner exist.                                                                                                                                                                                                                                                |
| Monthly Paperwork        | Admin Paperwork Center; **SOURCE-IMPLEMENTED, print-oriented**                                             | `/admin/paperwork/monthly`        | **MIGRATION-BACKLOG**                         | Four source templates: Windows/Bars/Doors; Chemical Agents; Contraband Search Standard; Contraband Search Expanded. Verify whether each needs editable persistence or print-only packet behavior; preserve source, version, print order, and blank-state rules.                                                                                                                                                                                |
| Accounts & Staff         | `/workspace/admin/accounts-staff`; **SOURCE-IMPLEMENTED**                                                  | `/admin/accounts-staff`           | **MIGRATION-BACKLOG**                         | Separate profile/account, minimal staff search fields, active state, role, temporary credential, session revocation, step-up, generic confirmations, historical attribution preservation, negative authorization tests.                                                                                                                                                                                                                        |
| Audit                    | `/workspace/admin/audit`; **SOURCE-IMPLEMENTED**                                                           | `/admin/audit`                    | **MIGRATION-BACKLOG**                         | Filtered, paginated, redacted action metadata. Never expose narrative bodies, policy questions/answers, PINs, tokens, signed URLs, or full source passages.                                                                                                                                                                                                                                                                                    |
| System Health            | `/workspace/admin/health`; **SOURCE-IMPLEMENTED**                                                          | `/admin/health`                   | **MIGRATION-BACKLOG**                         | Operational/Degraded/Unavailable/Unknown states from trustworthy checks; no secrets or misleading green state; distinguish dependencies and last checked time.                                                                                                                                                                                                                                                                                 |
| Review Lab               | `/workspace/admin/review-lab` launches legacy `/access-handoff`; **SOURCE-IMPLEMENTED but legacy-coupled** | no legacy handoff                 | **OUT-OF-SCOPE AS IMPLEMENTED**               | The new product is web-only. Omit the Access handoff and shared-code bridge. If a browser-native review workflow is still needed, write and approve a separate product contract before implementation.                                                                                                                                                                                                                                         |
| Shared print system      | `frontend/web/src/print/**`; **SOURCE-IMPLEMENTED**                                                        | route-specific print views        | **MIGRATION-BACKLOG**                         | Reuse print semantics and tests where possible, but validate real form fidelity, pagination, fonts, browser/printer/PDF behavior, source version, and private artifact authorization.                                                                                                                                                                                                                                                          |

## Detailed product contracts

### Officer Home

Home answers three questions: who is signed in, what work needs attention, and
where the employee should go next.

Required behavior:

- Four clear primary actions: start a report, continue/review reports, ask
  Policy Expert, and open Forms Library.
- NCU Days Count is prominent and reachable without navigating through
  administration.
- Summary data is scoped to the signed-in employee's authorized work.
- Workflow progress is calculated from persisted state.
- Home never substitutes a demo incident when no work exists.
- Home supports loading, no work, dependency failure, retry, and
  signed-out/session-expired states.

Parity evidence must include component tests plus real-browser desktop, mobile,
keyboard, zoom/reflow, reduced-motion, and no-console-error checks.

### Incident workflow

The six steps are a product state machine, not merely six client screens.

1. **Officers** — identify reporting/preparing/involved relationships without
   changing authorship.
2. **Field Notes** — save the employee's words with visible persistence state.
3. **Review Facts** — show proposed extraction, provenance, and editable
   unknowns; require explicit confirmation.
4. **Missing Information** — ask approved category/form-driven questions and
   allow Unknown/Not applicable.
5. **Reports** — generate versioned drafts from a named confirmed-fact revision
   and allow human edits.
6. **Forms & Export** — build a versioned packet, show
   capabilities/completeness, and require deliberate output actions.

Acceptance requires server-enforced transitions, reload/resume behavior,
multi-tab conflict handling, idempotent retries, and tests proving that
unconfirmed/model-invented facts cannot reach an output.

### Document Studio

Document Studio is the primary incident workspace after creation.

- **Overview** shows trustworthy incident and packet state.
- **Officer Reports** keeps reporting officer attribution, draft/revision state,
  and supported print/download actions.
- **Copy to Records** provides editable plain text with complete copy labels and
  no fake Print/Word actions.
- **Required Paperwork** groups required, suggested, additional, and
  physical-only work; it exposes source and capability.
- **Notes & Facts** distinguishes raw notes, proposed/confirmed facts, and gap
  answers.
- **History** shows append-only incident/report revisions and bounded actions.

The old source's flat key/value preview is reference code, not accepted
paper-form parity. Each supported official output needs an approved source,
version, mapping test, visual/print comparison, and records-owner sign-off.

### Forms and packet rules

The canonical old catalog includes digital documents, browser forms/checklists,
and physical-only reminders. Migration must retain capability distinctions.

- A physical-only item never receives a generated replacement layout.
- A digital item is not “downloadable” until the named format is generated
  successfully from the approved template.
- Required/suggested selection uses versioned, deterministic rules based on
  confirmed facts.
- AI may explain a suggestion but may not silently make an item required.
- Packet regeneration records the rule-set and source versions used.
- An employee may add/remove only where policy permits, with an attributable
  reason when required.

### Policy Expert and reader

Policy Expert must return a clear no-answer state when retrieval cannot support
an answer. A valid answer provides claim-level links to a registered source,
page span, and excerpt that can be revalidated against stored chunk text.

The Full Policy Reader opens the authorized source at the relevant passage while
preserving question-page focus and scroll position on return. Source files
remain private; raw storage keys and provider URLs are never treated as public
identifiers.

### Administrative oversight

Administrator capabilities are visibly separate and server-enforced. Sensitive
actions show actor, subject, current state, proposed state, impact, and reason.
Original officer attribution is never overwritten by administrator edits.

Administrative completion requires tests for direct URL/API access, role
downgrade, expired step-up, stale revisions, duplicate requests, inactive
accounts, and redacted logs—not just tests that an admin button works.

## Cross-cutting parity gates

A feature reaches parity only when all applicable gates pass:

| Gate          | Required evidence                                                                                                                    |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Product       | Behavior matches this catalog and the safety invariants; gaps have explicit owner decisions.                                         |
| Data          | Schema constraints, migration/rollback, RLS, indexes, retention classification, and fictional seed are reviewed.                     |
| API           | Versioned request/response schemas, authorization, validation, idempotency, error contract, and generated client/type tests.         |
| UX            | Loading, empty, success, unsaved, reconnecting, conflict, failure, unauthorized, and session-expired states work.                    |
| Accessibility | Automated semantics/contrast checks plus manual keyboard, screen-reader, high-contrast, zoom, touch, and reduced-motion evidence.    |
| Print/export  | Browser print preview, supported printer/PDF path, pagination, fonts, blank handling, source version, and authorization pass.        |
| Security      | Negative access tests, secret/client-bundle scan, dependency review, rate limiting, audit redaction, and object-storage policy pass. |
| Reliability   | Refresh/resume, duplicate request, partial dependency failure, concurrency, backup/restore, and observable retry behavior pass.      |
| Deployment    | Exact commit, environment, migration revision, configuration, health checks, and real-browser route evidence are recorded.           |

## Known source gaps that must not be copied forward

- The legacy OpenAPI description does not cover all live Home, Forms, Policy,
  Account, and administration behavior.
- The Vite app assumes Flask `/workspace` hosting and `/api/web/v1` cookie/CSRF
  conventions.
- New Report includes current-officer assumptions, a free-text category, and
  hard-coded gap questions.
- Save behavior is not uniformly complete across all workflow steps.
- Generic form previews do not prove official document fidelity or supported
  downloads.
- Weekly paperwork has no approved source template.
- The full-policy reader is branch-only and tied to Flask/Jinja/vanilla
  JavaScript.
- Policy retrieval is tied to Google Discovery Engine/Agent Builder and Gemini.
- Review Lab depends on a legacy `/access-handoff` workflow excluded from the
  web-only replacement.
- Styling and icons are fragmented across feature stylesheets and two visual
  approaches; consolidate deliberately rather than importing override order.
- Automated evidence does not close the old project's remaining manual
  screen-reader, on-screen-keyboard, physical high-contrast/scaling,
  performance, generated-asset, printer, pilot, and release-owner gates.
