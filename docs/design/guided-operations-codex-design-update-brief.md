# Guided Operations — Codex Design Update and Implementation Brief

**Recommended repository path:**
`docs/design/guided-operations-codex-design-update-brief.md`

**Prepared:** August 31, 2026  
**Repository:** `justinpeterman-droid/guided-operations`  
**Baseline:** current `main` branch at the time this document was prepared  
**Purpose:** give Codex one authoritative, implementation-ready design brief
that combines the GitHub research, current architecture, product constraints,
recommended component system, page-by-page design direction, adoption choices,
and acceptance criteria.

> This document is a design and implementation contract. It is not permission
> to bypass the repository's security, authorization, revision, retention,
> privacy, release, or real-data controls.

## 1. How Codex must use this document

Before changing code, Codex must:

1. Inspect the current branch, open pull requests, and any active worktree before
   editing. Do not overwrite newer work or assume this document is newer than
   the code.
2. Read `ARCHITECTURE.md`, `SECURITY.md`,
   `docs/product/roles-and-permissions.md`, the feature catalog/parity matrix in
   `docs/product/`, and the architecture documents relevant to the surface being
   changed.
3. Inspect the existing implementation and tests for the target route before
   proposing a replacement.
4. Preserve all server-side authorization, RLS, immutable revision, audit,
   retention, and redaction contracts.
5. Implement the work in small, reviewable slices. Do not combine a design-system
   migration, dependency migration, feature build, and backend redesign into one
   pull request.
6. Add or update tests in the same pull request as the behavior they protect.
7. Use fictional development and test data only.
8. Run the applicable repository checks and report the actual results. Do not
   claim a route, workflow, print artifact, browser path, or accessibility state
   is complete without evidence.

When this brief leaves a visual choice open, prefer the lowest-risk option that:

- fits the existing Guided Operations design language;
- reuses the current architecture and domain model;
- improves clarity and accessibility;
- introduces the fewest new dependencies;
- keeps interactive client boundaries narrow; and
- is easy to verify and reverse.

## 2. Primary objective

Modernize Guided Operations into a calm, dependable correctional operations
workspace that is easier to scan, easier to navigate, and safer to use under
pressure.

The design update should:

- create a consistent officer and administrator command-center experience;
- turn the existing custom styles into reusable design tokens and components;
- improve information hierarchy, responsive behavior, empty/error/loading
  states, and keyboard operation;
- establish shared table, form, status, timeline, and action patterns;
- make permissions, workflow state, save state, source provenance, and next
  actions visible without exposing restricted information;
- preserve the existing navy-and-gold institutional identity; and
- support future notifications, shift handover, attachments, scheduling,
  offline drafts, and policy-ingestion improvements without redesigning every
  page again.

This is **not** a re-platforming project. The current application architecture
and security boundaries remain authoritative.

## 3. Non-negotiable constraints

### 3.1 Architecture

- Keep Next.js App Router and React.
- Keep Supabase Auth, PostgreSQL, private Storage, Queues/PGMQ, and pgvector as
  the selected platform boundaries.
- Keep the browser behind the same-origin Next.js backend-for-frontend.
- Keep server-only authentication, authorization, DAL, storage, AI, queue, and
  export operations.
- Keep PostgreSQL constraints, grants, and RLS as defense in depth.
- Keep PostgreSQL as the source of truth for record and workflow state.
- Keep Storage as the source of truth for private file bytes.
- Queue messages must point to authoritative work records instead of carrying
  sensitive narratives.
- Do not add a durable worker until measured workload and the existing ADR exit
  criteria justify one.
- Do not reintroduce Google Cloud, Firebase, Cloud Run, Cloud SQL, Cloud Storage,
  Cloud Tasks, Vertex AI, Agent Builder, Discovery Engine, or Google Secret
  Manager.

### 3.2 Identity and authorization

- The initial interactive roles remain **officer** and **administrator**.
- Supervisor, reporting officer, preparing officer, reviewer, rank, and shift are
  operational relationships or attributes—not additional application roles
  unless the product contract is explicitly changed.
- Never rely on navigation, hidden buttons, CASL, client state, local storage, or
  URL secrecy as authorization.
- Never derive the authoritative role from browser-controlled data.
- Every read and mutation must continue through the server's verified session
  and authorization path.
- Missing role, facility scope, relationship, shift assignment, source
  authorization, or step-up proof must fail closed.
- Permission-aware UI may explain or hide actions, but the server and database
  still make the decision.

### 3.3 Data and privacy

- Do not use real incidents, residents, staff, rosters, reports, policy
  questions, credentials, or operational records in local development, CI,
  Preview, screenshots, fixtures, or demos.
- Do not place credentials, session tokens, PIN-like secrets, employee numbers,
  narratives, policy text, prompts, generated answers, or full source excerpts
  in logs or telemetry.
- Dynamic authenticated responses remain private and no-store unless a route has
  an explicit, tested cache policy.
- Offline support must not become a broad cache of protected pages or records.
- Generated or extracted AI content remains reviewable, attributed, and linked
  to evidence. It may not silently overwrite human work.

### 3.4 Product honesty

- Never show fabricated operational metrics, incidents, notifications, health
  states, sync times, work queues, or completion states.
- Unsupported features must be labeled unavailable, physical-only, not
  configured, or pending approval.
- A route existing is not proof of end-to-end parity.
- A test passing is not proof of production readiness.
- A visual preview is not proof that a form, report, download, or print artifact
  is operationally approved.

## 4. Current repository baseline to preserve

At the preparation baseline, the repository uses:

- Next.js 16;
- React 19;
- TypeScript;
- Supabase;
- PostgreSQL;
- Zod;
- Vitest;
- Playwright; and
- axe-core.

The application already has protected officer, report, Count Sheet, forms,
Policy Expert, account, administrator, audit, health, retention, and paperwork
surfaces in varying states of completion. It also already has an extensive
custom visual system in `src/app/globals.css`, including `--gow-*` design tokens,
focus-visible styling, responsive layout rules, institutional navy/gold colors,
surface treatments, typography, radii, and shadows.

Codex must improve this foundation rather than replacing it with a generic admin
starter.

### 4.1 CSS migration rule

Do not rewrite the entire stylesheet in one pull request. Use progressive
extraction:

1. Keep `src/app/globals.css` as the global entry point.
2. Extract stable root variables into a dedicated token file.
3. Extract reset, typography, focus, and global accessibility rules into a base
   file.
4. Move reusable component styles into component-level CSS modules or a clearly
   named shared component stylesheet.
5. Move route-specific styles beside the route or feature as that route is
   converted.
6. Remove old selectors only after search, visual comparison, and tests prove
   they are unused.

Do not introduce Tailwind, a shadcn starter, a Vite shell, or a second global
style system as part of this design update unless a separate architecture
change is approved.

## 5. Design direction

### 5.1 Visual character

Guided Operations should feel:

- calm rather than flashy;
- official rather than consumer-oriented;
- clear rather than decorative;
- dense enough for operational work without becoming cramped;
- trustworthy under degraded, empty, or partial-data conditions; and
- consistent across officer and administrator surfaces.

Retain the existing institutional identity:

- deep navy for authority and primary actions;
- restrained gold for emphasis, selection, progress, and identity;
- cool neutral canvases and white/raised surfaces;
- strong ink colors for readable content;
- soft shadows and borders rather than glassmorphism;
- the existing brand serif for major headings and sans-serif for operational
  content.

### 5.2 Hierarchy

Each page should answer, in order:

1. **Where am I?** Page title, facility or scope, and navigation context.
2. **What state is this in?** Status, workflow stage, source, revision, and
   availability.
3. **What needs attention?** Exceptions, missing information, conflicts,
   deadlines, or pending review.
4. **What can I do next?** One primary action and a restrained set of secondary
   actions.
5. **What evidence supports this?** Attribution, history, source form, policy
   citation, or audit trail where relevant.

### 5.3 Interaction principles

- One dominant primary action per page or panel.
- Destructive and high-impact actions remain visually separated and require the
  existing confirmation or step-up behavior.
- Status is communicated with text and iconography, not color alone.
- Disabled controls must explain why the action is unavailable when the reason
  is safe to disclose.
- Hidden controls are appropriate when revealing the capability itself would be
  misleading or disclose unauthorized scope.
- Autosave indicators must distinguish saving, saved, offline, failed, stale,
  and conflict states.
- Finalize, restore, archive, release hold, reset credential, change role, and
  other consequential actions are always deliberate; they are not triggered by
  autosave.
- Empty states explain what the user can do next without inventing sample work.
- Error states preserve typed work whenever possible and expose a safe request
  or correlation ID where the existing contract supports it.

### 5.4 Responsive behavior

Design and test at minimum:

- wide desktop operations view;
- standard laptop;
- tablet portrait and landscape;
- narrow mobile; and
- 200% browser zoom/reflow.

On narrow screens:

- collapse the navigation into an accessible drawer;
- keep the page title, status, and primary action visible near the top;
- convert nonessential table columns into row details or a card-style summary;
- preserve all authorized actions through an accessible row-action menu;
- avoid horizontal scrolling for ordinary workflows; and
- allow horizontal scrolling only for inherently tabular forms such as the
  Count Sheet, with sticky labels and clear scroll affordances.

### 5.5 Motion and feedback

- Keep transitions short and functional.
- Respect `prefers-reduced-motion`.
- Do not animate large page regions merely for decoration.
- Use live-region announcements for validation, save state, conflicts,
  completion, and errors where appropriate.
- Restore focus after drawers, dialogs, route transitions, and failed actions.

## 6. Shared component system

The exact filenames may follow the repository's existing conventions, but the
capabilities below should become reusable components or feature primitives.
Avoid a single oversized command-center component.

### 6.1 Shell and navigation

Create or refine:

- `WorkspaceShell`
- `OfficerNavigation`
- `AdminNavigation`
- `MobileNavigationDrawer`
- `WorkspaceHeader`
- `AccountMenu`
- `ConnectionAndSaveStatus`

Requirements:

- server-supplied role and identity context;
- clear separation between officer workspace and administrator entry;
- visible current location;
- keyboard and screen-reader operability;
- focus restoration when the mobile drawer closes; and
- no unauthorized route discovery through client-only filtering.

### 6.2 Page structure

Create consistent primitives for:

- `PageHeader`
- `PageActions`
- `SectionHeader`
- `ContentPanel`
- `DetailGrid`
- `StickyActionBar`
- `Breadcrumbs` only where they clarify nested administrative or incident
  context

Every protected page should use a recognizable title, supporting description,
status region, and action region rather than inventing a new header arrangement.

### 6.3 Status and feedback

Create a shared status vocabulary and visual treatment for:

- draft;
- in progress;
- needs review;
- missing information;
- complete;
- finalized;
- corrected;
- archived;
- on legal hold;
- unavailable;
- degraded;
- unknown;
- saving;
- saved;
- save failed;
- offline;
- stale; and
- conflict.

Recommended primitives:

- `StatusBadge`
- `AvailabilityBadge`
- `SaveStatus`
- `InlineAlert`
- `ConflictBanner`
- `RequestIdNotice`
- `ProgressSummary`

Do not use a green success state for unknown, unverified, or merely reachable
services.

### 6.4 Actions

Standardize:

- primary action;
- secondary action;
- quiet/text action;
- destructive action;
- elevated or step-up-required action;
- print/download/copy output action; and
- row action menu.

Actions should have consistent ordering, icon placement, loading behavior,
confirmation behavior, and safe failure messaging.

### 6.5 Loading, empty, unavailable, and error states

Create reusable:

- `LoadingSkeleton`
- `EmptyState`
- `UnavailableState`
- `ErrorState`
- `PermissionDeniedState`
- `SessionExpiredState`

A loading skeleton must reflect the shape of the actual surface. An empty state
must not render fictional metrics or records. An unavailable state must explain
whether the limitation is source approval, configuration, authorization,
dependency failure, or unsupported functionality when safe to disclose.

### 6.6 Timeline and provenance

Create a reusable `ActivityTimeline` capable of showing safe, authorized events
for:

- incident and report revisions;
- officer and administrator attribution;
- confirmed facts;
- corrections and restores;
- paperwork revisions;
- print/download requests;
- legal hold placement/release;
- account lifecycle actions; and
- notification acknowledgement.

Timeline entries should expose bounded action metadata, timestamps, actor display
information when authorized, and links to the applicable revision or record.
They must not expose secret, credential, narrative, prompt, or full-policy
content in audit-oriented views.

## 7. Shared operational table specification

Adopt **TanStack Table** as the headless table engine while retaining Guided
Operations styling and server authority.

### 7.1 Required capabilities

- server-driven pagination;
- server-driven filtering and search where the dataset can exceed one page;
- typed column definitions;
- sortable columns only where sorting is meaningful and authorized;
- filter chips and a clear reset action;
- explicit loading, empty, unavailable, and error states;
- keyboard-accessible headers and row actions;
- responsive column priority;
- optional column visibility for non-sensitive fields;
- bulk selection only for actions that have an approved server contract;
- safe result counts that do not reveal hidden records; and
- stable URLs or query parameters for shareable administrative filters only when
  those parameters do not expose protected content.

### 7.2 Table design

Each operational row should show the minimum information needed to decide the
next action:

- primary record identifier or title;
- current state;
- responsible or attributed person when authorized;
- relevant date/time;
- progress or exception indicator;
- one direct row action; and
- an overflow menu for secondary actions.

Do not put every database field into the table. Use a details drawer or record
page for secondary information.

### 7.3 First conversion

Convert `/reports` first because it provides the best reusable pattern for later
administrator incident, staff, audit, retention, and paperwork lists.

The `/reports` conversion must preserve:

- authorized-row scoping;
- workflow progress calculated from persisted state;
- useful search and filters;
- no count leakage;
- loading, no-work, dependency-failure, and retry states;
- mobile access to every permitted row action; and
- direct navigation into the correct report or incident workspace.

## 8. Shared form system specification

Adopt **React Hook Form** with the repository's existing **Zod** schemas.

### 8.1 Required field primitives

Create typed wrappers for:

- text;
- textarea;
- number;
- date;
- time;
- date/time;
- checkbox;
- radio group;
- select;
- multi-select only where approved;
- employee/officer picker with minimum authorized fields;
- repeatable rows;
- read-only calculated value;
- source-bound field; and
- attachment field when the attachment pilot is approved.

Each primitive must support:

- label;
- description;
- required/optional state;
- field-level error;
- disabled/read-only reason;
- keyboard operation;
- screen-reader association; and
- consistent spacing and focus treatment.

### 8.2 Save and conflict behavior

The shared form system must support:

- dirty-field tracking;
- explicit save state;
- safe autosave for approved draft fields;
- base revision or optimistic concurrency token;
- stale revision response;
- preservation of typed values after a failed save;
- conflict comparison and deliberate resolution;
- append-only revision creation; and
- deliberate finalization separate from draft save.

Never hide a conflict by applying last-write-wins in the browser.

### 8.3 First conversion

Convert one Daily Paperwork form after the shared field primitives and conflict
behavior exist. Do not convert all six forms at once. Use the first form to prove:

- approved source order;
- repeating rows;
- keyboard flow;
- validation announcement;
- draft save/reopen;
- stale-write handling;
- revision history;
- exact restore behavior;
- print layout; and
- administrator-only access.

## 9. Permission-aware UI specification

Adopt **CASL** only as a reusable UI ability layer.

### 9.1 Allowed use

CASL may decide whether to render or enable client controls based on a bounded,
server-supplied capability model, such as:

- view a record;
- edit a draft;
- confirm facts;
- finalize a report;
- print or download a supported output;
- restore a revision;
- enter administrator surfaces;
- change an account state; or
- place/release a legal hold.

### 9.2 Forbidden use

CASL must not:

- replace server authorization;
- replace RLS;
- accept role or facility scope from browser-controlled storage;
- authorize a record based only on a route parameter;
- reveal restricted record counts;
- expose administrator actions before verified capability data is available; or
- turn a server denial into a client success state.

### 9.3 UX behavior

Use three deliberate outcomes:

1. **Hide** an action when displaying it would reveal or imply an unauthorized
   capability.
2. **Disable with an explanation** when the user is authorized to know the
   action exists but a workflow, source, state, or step-up requirement blocks it.
3. **Show and enforce** when both the UI capability and server contract permit
   it.

Add negative tests proving an officer cannot reach administrator behavior by
changing client state or invoking the endpoint directly.

## 10. Page-by-page design update

### 10.1 Sign in

- Preserve the current Guided Operations identity and restrained sign-in card.
- Make employee number and passcode wording match the approved product contract.
- Keep errors generic and avoid confirming account existence.
- Present temporary-credential and required-passcode-change states clearly.
- Keep support/recovery language honest; do not imply an unimplemented recovery
  channel.
- Make the real sign-in action visually dominant.

### 10.2 Officer Home

The Home page must answer:

- who is signed in;
- what authorized work needs attention; and
- where to go next.

Use:

- four primary action cards: start a report, continue/review reports, ask Policy
  Expert, and open Forms Library;
- a prominent NCU Days Count shortcut;
- up to two authorized recent-work summaries;
- honest loading/no-work/error states; and
- a small connection/save-status region only when backed by real state.

Do not use decorative charts or invented counts. Home should remain calm and
fast.

### 10.3 Reports list

Use the shared operational table.

Recommended columns:

- report or incident reference;
- type;
- workflow stage;
- progress or missing-information indicator;
- last authorized activity date;
- attribution when authorized; and
- next action.

On mobile, show a compact record card with the same state and action access.

### 10.4 New Report and incident workflow

Treat the six steps as a visible product state machine:

1. Officers
2. Field Notes
3. Review Facts
4. Missing Information
5. Reports
6. Forms & Export

Design requirements:

- persistent step navigation with completed/current/blocked states;
- clear source and attribution context;
- save status that survives route-level errors;
- visible missing-information summary;
- AI suggestions labeled as suggestions until confirmed;
- citation/source links where AI or policy evidence is involved;
- conflict banner and comparison before overwriting a newer revision; and
- deliberate finalization and output actions.

Do not convert the workflow into six unrelated client-only screens.

### 10.5 Document Studio and report detail

Use tabs or section navigation for:

- Overview
- Officer Reports
- Copy to Records
- Required Paperwork
- Notes & Facts
- History

Keep original officer attribution visible. Administrator editing must display an
administrator-attribution banner and the existing elevated-action requirements.

Use a sticky action area for safe draft actions and a separate output area for
print/download/copy actions supported by that report type and state.

### 10.6 Forms Library

Show a capability catalog rather than a generic file gallery.

Each form or packet item should display:

- approved name;
- source/version status;
- digital, print, copy, or physical-only capability;
- role availability;
- current implementation status; and
- primary next action.

Keep Chain of Custody explicitly physical-only unless an approved digital source
and process are added. Keep unsupported Monthly or Weekly work clearly labeled.

### 10.7 NCU Days Count

- Preserve the reviewed source order and calculation behavior.
- Keep shift context visible.
- Distinguish blank from zero.
- Make calculated values visually different from editable entries.
- Show save/revision state without crowding the sheet.
- Keep history/restore and print actions deliberate.
- Optimize the wide table for keyboard entry and one-page output fidelity.

### 10.8 Policy Expert

Use a two-part evidence-first layout:

- question and answer workspace; and
- retrieved source/citation panel.

Required states:

- ready;
- retrieving;
- answer with verified citations;
- insufficient support/refusal;
- provider unavailable;
- source unavailable; and
- session expired.

Never style unsupported model text as an authoritative answer. Citation cards
should identify source, page/section, and supporting excerpt within the approved
content limits.

### 10.9 Account

Separate ordinary self-service actions from high-impact session actions:

- profile summary;
- change passcode;
- current-session sign out;
- sign out all sessions; and
- session list/revocation only when the approved product contract is implemented.

Do not expose tokens, internal Auth identifiers, or other users.

### 10.10 Administrator overview

Build an actionable command center, not a vanity dashboard.

Prioritize:

- records needing review;
- stale or conflicted drafts;
- paperwork requiring action;
- account lifecycle exceptions;
- legal-hold/retention reviews;
- degraded or unavailable dependencies; and
- recent bounded operational events.

Every count or list must have loading, empty, unavailable, and error semantics.
Do not show a green metric merely because a page rendered.

### 10.11 Administrator incidents

Use the shared operational table with facility-authorized search and filters.
Keep row counts, filter metadata, exports, and pagination within the approved
scope. Provide a clear transition from list to incident workspace.

### 10.12 Administrator paperwork

Use clear Daily, Weekly, and Monthly sections.

- Daily: six approved form types and the generic revision-safe workflow.
- Weekly: honest not-configured/empty state until approved templates exist.
- Monthly: catalog only after source behavior and edit-vs-print requirements are
  approved.

Do not invent forms to fill visual space.

### 10.13 Accounts and staff

Use a compact roster table with:

- approved display identity;
- role;
- shift;
- account state;
- credential lifecycle state; and
- next administrative action.

Credential reset, unlock, disablement, role change, and shift change must remain
purpose-bound, step-up protected, confirmed, audited, and session-revoking where
required. The UI must never display an existing PIN or secret.

### 10.14 Audit

Use a filterable, paginated table plus a bounded detail drawer.

Safe fields include:

- time;
- action code;
- approved actor display;
- safe target reference;
- outcome;
- environment or source category where appropriate; and
- opaque request/correlation ID.

Never expose narratives, policy questions/answers, PINs, tokens, signed URLs,
full source passages, or hidden account identifiers.

### 10.15 System Health

Present each dependency as:

- Operational;
- Degraded;
- Unavailable; or
- Unknown.

Show the actual checked-at time and bounded reason. Unknown must not appear
healthy. Avoid exposing credentials, provider internals, or sensitive payloads.

### 10.16 Retention and legal hold

Use separate views for:

- upcoming review;
- on hold;
- eligible for controlled deletion;
- deletion evidence; and
- completed or blocked actions.

Placement and release of legal hold remain separate step-up actions. The design
must make immutable history and the absence of an unauthorized cleanup path
clear.

## 11. First-party operational features to build

The following should be native Guided Operations features rather than imported
platforms.

### 11.1 Notification inbox

Build an in-app inbox on authoritative database records before adding external
channels.

Each notification should have:

- recipient or recipient scope;
- source record;
- event type;
- severity;
- created time;
- due/escalation time when applicable;
- read state;
- acknowledgement state;
- resolution link;
- delivery attempts if external channels are later added; and
- bounded audit events.

The design should support unread, acknowledged, overdue, resolved, and delivery
failure states. Do not include sensitive narrative content in notification
previews when a safe record reference is sufficient.

### 11.2 Unified activity timeline

Build one timeline component and event vocabulary that can be reused across
incidents, reports, paperwork, retention, account administration, and
notifications.

### 11.3 Shift handover and operational logbook

Build this inside the existing revision and audit model.

A handover entry should be linked to verified records where possible and should
support:

- shift and time window;
- concise factual summary;
- source links;
- follow-up owner;
- due time;
- acknowledgement;
- unresolved status;
- amendment through a new revision; and
- administrator visibility consistent with approved scope.

AI-generated briefing text may summarize verified entries, but every summary
must link back to the authoritative records and remain reviewable.

## 12. Bounded prototypes

Each prototype must be isolated from production behavior and must use fictional
fixtures.

### 12.1 Uppy attachment prototype

Goal: prove a safe, resilient attachment UX for incident evidence or approved
paperwork.

Test:

- file selection;
- camera capture where browser support allows;
- progress;
- cancellation;
- retry;
- resumable upload;
- size/type limits;
- duplicate handling;
- interrupted network;
- logout/session expiry;
- private Supabase Storage authorization;
- metadata validation;
- malware/content-review boundary if required by policy; and
- no public object URLs.

Adopt only after server-side object authorization and cleanup behavior pass.

### 12.2 pdfme form-fidelity prototype

Goal: reproduce one approved official form without claiming broader parity.

Compare:

- source dimensions;
- field placement;
- line wrapping;
- fonts;
- checkboxes;
- repeating rows;
- pagination;
- browser preview;
- downloaded PDF;
- Chromium print-to-PDF;
- a physical printer sample; and
- deterministic output from the same approved revision.

Adopt only if the result meets owner-approved fidelity and license review.

### 12.3 Schedule-X prototype

Goal: prove one week of staff/duty-position scheduling.

Test:

- day/week views;
- assignment creation and editing;
- conflict indicators;
- unfilled positions;
- shift filters;
- keyboard use;
- tablet use;
- timezone behavior;
- daylight-saving transitions;
- print/export requirements; and
- authorization of staffing data.

Do not build a generic workforce-management system.

### 12.4 Serwist + Dexie offline-draft prototype

Goal: preserve one narrowly scoped unfinished draft during connection loss.

The prototype must:

- cache app assets separately from protected content;
- store only the minimum draft fields;
- bind the draft to the current user/session/device context;
- expire drafts;
- purge on successful sync, logout, or explicit discard;
- detect base-revision conflicts;
- require deliberate review before uploading after reconnect;
- avoid caching full protected responses;
- avoid storing credentials or tokens; and
- prove behavior through browser tests.

Do not describe browser storage as a secure archival system.

### 12.5 Docling vs. MinerU policy-ingestion benchmark

Docling is the default integration candidate. MinerU is a benchmark challenger
pending complete license/model/artifact review.

Use the same representative corpus for both:

- native PDFs;
- scanned PDFs;
- DOCX;
- tables;
- headers and footers;
- multi-column pages;
- page numbering;
- attachments;
- poor scans; and
- mixed text/image pages.

Score:

- reading order;
- headings;
- table structure;
- page mapping;
- citation addressability;
- OCR accuracy;
- source-image linkage;
- Markdown/JSON quality;
- deterministic reruns;
- CPU/GPU use;
- throughput;
- failure recovery;
- provenance metadata; and
- licensing suitability.

Store source hash, parser, parser version, model/version where applicable,
configuration digest, processing time, and derived-artifact hash for every test
run.

## 13. Adopt, build, and ignore decisions

### 13.1 Adopt now

- TanStack Table
- React Hook Form
- CASL for UI capability rendering only
- existing Playwright
- existing axe-core
- current Guided Operations design tokens and brand

### 13.2 Adopt or pilot next

- XState for transition models and tests
- Uppy for attachments
- pdfme for official-form fidelity
- Schedule-X for staffing views
- Serwist plus Dexie for the bounded offline-draft experiment
- Docling for policy/document ingestion
- Sentry only after the redaction contract is enforced

### 13.3 Build natively

- notification inbox and escalation semantics;
- activity/audit timeline;
- shift handover;
- operational logbook;
- acknowledgements and follow-up ownership;
- correctional workflow state rules;
- facility-specific duty-position model;
- offline conflict-review behavior; and
- role/relationship semantics.

### 13.4 Do not integrate now

- a wholesale admin starter;
- React Admin or Refine as a replacement framework;
- SurveyJS as a second authoritative form platform;
- FullCalendar unless Schedule-X fails the prototype;
- BullMQ/Redis;
- pg-boss alongside PGMQ;
- Graphile Worker alongside PGMQ;
- Trigger.dev, Hatchet, Temporal, n8n, or Windmill before measured need;
- Novu before the first-party notification model exists;
- OpenTelemetry before simpler redacted monitoring proves insufficient;
- a second vector database;
- Unstructured unless Docling fails required formats;
- MinerU integration before licensing review; or
- code from repositories with no reusable license.

## 14. Implementation sequence

Do not attempt every item in one branch. Use the sequence below unless current
repository work makes a smaller slice more appropriate.

### Phase 0 — Baseline and visual inventory

Deliverables:

- route inventory;
- current component inventory;
- current design-token inventory;
- screenshots at desktop, tablet, mobile, and 200% zoom using fictional data;
- list of duplicated page patterns;
- list of oversized client components;
- list of accessibility or responsive failures already covered by tests; and
- confirmed target for the first conversion.

No broad redesign should begin until the baseline is recorded.

### Phase 1 — Design foundation

Deliverables:

- extracted tokens/base styles without changing the brand;
- shared page header, panel, action, status, feedback, loading, empty, and error
  primitives;
- responsive shell and navigation improvements;
- component examples or a protected development-only component gallery if the
  repository already has an approved pattern for one; and
- component/unit/accessibility tests.

Avoid changing business behavior in this phase.

### Phase 2 — Shared operational table

Deliverables:

- TanStack Table dependency and wrapper;
- server-driven table contract;
- accessible filter bar;
- responsive row/card behavior;
- `/reports` conversion;
- tests for filtering, pagination, no-work, failure, keyboard use, and denied
  data; and
- before/after screenshots.

### Phase 3 — Shared form system

Deliverables:

- React Hook Form dependency;
- typed Zod-connected field primitives;
- save-status and conflict components;
- one Daily Paperwork conversion;
- tests for validation, repeating rows, autosave, stale revision, restore, and
  print; and
- evidence that typed work is preserved after recoverable errors.

### Phase 4 — Permission-aware rendering

Deliverables:

- small CASL ability model built from server-supplied capabilities;
- shared `Can`/permission helper or equivalent;
- conversion of navigation and row/form actions on the already-modernized
  surfaces;
- negative component, route, endpoint, and database tests; and
- no reduction in existing server/RLS controls.

### Phase 5 — Administrator surface conversion

Convert one surface at a time in this order unless active work dictates
otherwise:

1. administrator incidents;
2. accounts and staff;
3. audit;
4. retention/legal hold;
5. system health; and
6. paperwork catalog/workspace.

Each conversion must use the shared shell, table, form, status, timeline, and
feedback patterns rather than adding route-specific substitutes.

### Phase 6 — First-party notification and activity model

Deliverables:

- approved data model/migration;
- server/DAL contracts;
- in-app inbox;
- acknowledgement and escalation behavior;
- unified activity timeline;
- audit/redaction tests; and
- role/scope denial tests.

Do not add email, SMS, or push until the in-app authoritative model is accepted.

### Phase 7 — Independent prototypes

Run Uppy, pdfme, Schedule-X, offline-draft, and policy-ingestion prototypes on
separate branches or isolated feature flags. Do not couple their adoption to the
core design-system pull requests.

## 15. Testing and acceptance criteria

### 15.1 Required repository checks

Run the applicable commands from the current repository, including:

```bash
npm run format:check
npm run lint
npm run typecheck
npm run test
npm run build
```

For affected browser surfaces, also run the applicable Playwright suites, such
as:

```bash
npm run test:e2e:preview
```

Run the local authenticated qualification when the required environment is
available and the command's safeguards are satisfied:

```bash
npm run test:e2e:local-auth
```

Do not weaken a check, remove a guard, lower coverage, or exclude a failing route
merely to make the branch green.

### 15.2 Visual acceptance

For each converted route, provide fictional-data screenshots for:

- desktop;
- tablet;
- mobile;
- empty state;
- loading state where practical;
- error/unavailable state;
- permission-denied or blocked action where applicable;
- stale/conflict state where applicable; and
- print/PDF output where applicable.

Confirm:

- no overlapping controls;
- no clipped text;
- no unexpected horizontal scrolling;
- consistent spacing and typography;
- visible focus;
- readable status at high zoom; and
- no fabricated data.

### 15.3 Accessibility acceptance

At minimum:

- axe-core reports no unreviewed serious or critical violations;
- all actions are keyboard reachable;
- logical tab order;
- visible focus;
- focus returns after drawers/dialogs;
- labels and errors are programmatically associated;
- status changes are announced where appropriate;
- tables have correct headers and accessible action names;
- color is not the only status signal;
- content reflows at 200% zoom; and
- reduced-motion behavior is respected.

Automated checks do not replace manual keyboard, zoom/reflow, and screen-reader
review.

### 15.4 Security and authorization acceptance

For every changed protected surface:

- unauthenticated access is denied;
- an officer cannot access another employee's unauthorized record;
- an officer cannot invoke administrator behavior;
- inactive/locked/revoked sessions are denied as required;
- missing capability facts fail closed;
- direct endpoint calls cannot bypass the UI;
- row counts and filters do not leak hidden records;
- Storage actions remain private and authorized;
- no sensitive values enter logs, analytics, URLs, or client persistence; and
- role, shift, facility, and relationship changes take effect according to the
  current session-revocation contract.

### 15.5 Data integrity acceptance

- finalization remains deliberate;
- revision history remains append-only;
- restore creates a new revision;
- stale writes do not overwrite newer work;
- typed work is preserved during recoverable failures;
- output uses an explicit approved revision;
- generated artifacts are deterministic where required;
- AI suggestions remain pending until confirmed; and
- citations/source provenance remain intact.

### 15.6 Performance acceptance

- keep client bundles narrow;
- do not turn server-renderable pages into large client components;
- avoid loading table, calendar, upload, PDF, or offline libraries on routes that
  do not use them;
- lazy-load heavy prototype components;
- use server pagination for large lists;
- avoid duplicated data fetching;
- verify there are no new console errors or repeated failed requests; and
- record meaningful before/after bundle or route measurements when adding a
  large dependency.

## 16. Pull-request rules

Every implementation pull request should contain:

- concise problem statement;
- scope and non-goals;
- design decisions;
- files and routes changed;
- dependencies added or deliberately avoided;
- screenshots using fictional data;
- tests added and commands run;
- actual test results;
- accessibility findings;
- authorization/security findings;
- migration or rollback notes;
- unresolved risks; and
- the next recommended slice.

Do not describe work as complete when hosted browser qualification, source
approval, owner acceptance, print fidelity, provider controls, migration,
backup/restore, or production gates remain outstanding.

## 17. Definition of done for the design modernization

The design modernization is complete only when:

- officer and administrator shells use the shared design system;
- major protected routes use consistent page, status, feedback, action, and
  responsive patterns;
- operational lists use the shared table system;
- complex editable workflows use the shared form system;
- permission-aware rendering is consistent without weakening server/RLS
  enforcement;
- loading, empty, unavailable, error, stale, and conflict states are truthful and
  tested;
- keyboard, focus, zoom/reflow, reduced motion, and automated accessibility
  checks pass the approved threshold;
- no real data was used outside approved Production;
- no sensitive content was added to logs or browser persistence;
- print/download surfaces are labeled according to actual supported behavior;
- all applicable repository checks pass; and
- the owner accepts the resulting officer and administrator experience.

## 18. Ready-to-use Codex task prompt

Use the following prompt from the repository containing this file:

```text
Read docs/design/guided-operations-codex-design-update-brief.md and the current
repository documentation it identifies. Inspect the current branch and active
work before changing anything.

Begin with Phase 0 and Phase 1 only: create a current visual/component inventory,
then progressively extract the existing Guided Operations design tokens and
build the shared page, panel, action, status, feedback, loading, empty, error,
and responsive shell primitives. Preserve the existing navy/gold brand,
Next.js/Supabase architecture, officer/administrator role model, server/RLS
authority, revision history, audit/redaction rules, and fictional-data boundary.

Do not re-platform onto an admin starter, Tailwind, Vite, React Admin, Refine, or
shadcn-admin. Do not add new backend features during the foundation PR. Add or
update component and browser tests, run the applicable checks, and include
fictional-data screenshots plus an evidence-based summary of what remains.
```

---

## Appendix A — Complete GitHub Research and Adoption Matrix

The complete research report is retained below so Codex can trace every adopt,
build, pilot, and ignore decision without opening a second document.

### Original research report

**Research date:** August 31, 2026  
**Baseline:** `justinpeterman-droid/guided-operations`, current `main` branch  
**Repositories reviewed and classified:** 50

> **Meaning of the labels**  
> **STEAL** means adopt a library or deliberately reuse a proven pattern after license/security review.  
> **BUILD** means Guided Operations should own the implementation because the behavior is correctional, security-sensitive, or tightly coupled to its audit/revision model.  
> **IGNORE** means do not integrate now; it may still be a useful comparison point.

### Executive conclusion

Guided Operations should **not** be rebuilt on an admin starter or imported case-management platform. The current system already has the right high-level authority boundaries: Next.js as backend-for-frontend, Supabase Auth/Postgres/Storage/Queues, server authorization, RLS defense in depth, immutable revisions, and an optional worker only when measured workloads require it.

The highest-return approach is to add a small number of mature headless libraries around the existing domain model, while keeping correctional workflows, notification semantics, shift handover, audit history, retention, and authorization authoritative inside Guided Operations.

- **22** repositories contain libraries or patterns worth adopting.
- **10** repositories suggest features that should be implemented natively.
- **18** repositories would add duplication, infrastructure, licensing uncertainty, or architectural drift.

### Recommended adoption order

#### 1. Implement immediately

1. **TanStack Table** for a common operational data-grid layer.
2. **React Hook Form + existing Zod schemas** for complex paperwork and incident editing.
3. **CASL ability predicates** for permission-aware UI only; retain server/RLS enforcement.
4. **Playwright + axe-core expansion** for authenticated, responsive, keyboard, print, and role-denial qualification.
5. Extract the current custom CSS into reusable Guided Operations primitives instead of replacing the brand with a starter kit.

#### 2. Build the next operational layer

1. A first-party **notification inbox and escalation model** in Supabase.
2. A unified **activity/audit timeline** for incidents, reports, paperwork, legal holds, and account actions.
3. A native **shift handover/logbook** tied to verified records, acknowledgements, and follow-up tasks.
4. **XState transition models and tests** for workflows, while the database remains authoritative.
5. **Uppy-based attachment UX** backed by private Supabase Storage and current authorization checks.

#### 3. Run bounded prototypes

1. **pdfme:** reproduce one approved official form and compare browser preview, downloaded PDF, and physical print.
2. **Schedule-X:** prototype one week of staff/duty-position scheduling with conflict indicators.
3. **Serwist + Dexie:** offline draft/outbox proof with logout purge, expiry, reconnect conflict handling, and no broad protected-response caching.
4. **Docling vs. MinerU:** process the same representative policy set; score headings, tables, page mapping, reading order, citations, runtime, GPU/CPU use, and licensing. Docling is the safer default until the benchmark says otherwise.

### 50-repository matrix

| # | Area | Repository | Decision | Priority | Guided Operations use |
|---:|---|---|---|---|---|
| 1 | UI, forms & attachments | [TanStack/table](https://github.com/TanStack/table) | **STEAL — now** | High | Use as the headless engine for incident, reports, staff, audit, retention, and paperwork tables. Keep Guided Operations styling and server-side authorization. |
| 2 | UI, forms & attachments | [react-hook-form/react-hook-form](https://github.com/react-hook-form/react-hook-form) | **STEAL — now** | High | Use for complex form state, dirty-field tracking, validation messaging, and controlled submission; pair with the Zod schemas already in the repo. |
| 3 | UI, forms & attachments | [stalniy/casl](https://github.com/stalniy/casl) | **STEAL — now** | High | Use for permission-aware rendering and reusable ability predicates. Never treat it as enforcement; server checks and Supabase RLS remain authoritative. |
| 4 | UI, forms & attachments | [transloadit/uppy](https://github.com/transloadit/uppy) | **STEAL — next** | High | Pilot its modular/resumable upload patterns for incident attachments, camera capture, progress, retries, and cancellation while preserving private Supabase Storage rules. |
| 5 | UI, forms & attachments | [pdfme/pdfme](https://github.com/pdfme/pdfme) | **STEAL — pilot** | High | Test the WYSIWYG template designer and deterministic field placement against one approved official form. Adopt only after printer/PDF fidelity tests pass. |
| 6 | UI, forms & attachments | [satnaing/shadcn-admin](https://github.com/satnaing/shadcn-admin) | **STEAL — patterns** | Medium | Borrow responsive navigation, command/search, settings, dense page composition, and empty-state patterns. Do not replace the current branded shell or move the app to Vite. |
| 7 | UI, forms & attachments | [marmelab/react-admin](https://github.com/marmelab/react-admin) | **STEAL — patterns** | Medium | Study mature list filters, bulk actions, mutation states, undo/confirmation, and resource-detail layouts. Reimplement those patterns inside the existing Next.js architecture. |
| 8 | UI, forms & attachments | [refinedev/refine](https://github.com/refinedev/refine) | **STEAL — patterns** | Medium | Use as a reference for CRUD state, filters, optimistic interaction, and data-provider boundaries; importing the whole framework would duplicate the current DAL and routing model. |
| 9 | UI, forms & attachments | [marmelab/shadcn-admin-kit](https://github.com/marmelab/shadcn-admin-kit) | **STEAL — patterns** | Medium | Borrow admin list/create/edit/show composition, table controls, and action placement. Keep the current design tokens and security boundaries. |
| 10 | UI, forms & attachments | [Kiranism/next-shadcn-dashboard-starter](https://github.com/Kiranism/next-shadcn-dashboard-starter) | **IGNORE — starter** | Low | Useful only as visual inspiration. Re-platforming onto another starter would discard established authentication, revision, audit, and domain work. |
| 11 | UI, forms & attachments | [surveyjs/survey-library](https://github.com/surveyjs/survey-library) | **BUILD — own form engine** | Medium | Borrow conditional-field, repeatable-section, and schema-driven rendering ideas. Keep the approved-source form registry and server-owned validation rather than adopting a parallel survey platform. |
| 12 | UI, forms & attachments | [labs-code/gov-dashboard](https://github.com/labs-code/gov-dashboard) | **STEAL — patterns** | Low | Use as a public-sector dashboard reference for restrained information density and status presentation, not as an application foundation. |
| 13 | Quality, accessibility & observability | [microsoft/playwright](https://github.com/microsoft/playwright) | **STEAL/KEEP — now** | High | Already present. Expand authenticated officer/admin journeys, keyboard use, print/export, stale-revision recovery, offline recovery, and role-denial tests across Chromium, Firefox, and WebKit where feasible. |
| 14 | Quality, accessibility & observability | [dequelabs/axe-core](https://github.com/dequelabs/axe-core) | **STEAL/KEEP — now** | High | Already present. Run automated accessibility checks on every major protected route, while retaining manual keyboard, zoom/reflow, screen-reader, and focus-restoration review. |
| 15 | Quality, accessibility & observability | [getsentry/sentry-javascript](https://github.com/getsentry/sentry-javascript) | **STEAL — later** | Medium | Add only after the redaction contract is enforced. Capture bounded error identifiers, timings, release/environment, and safe stack data—never narratives, policy text, employee numbers, or credentials. |
| 16 | Quality, accessibility & observability | [open-telemetry/opentelemetry-js](https://github.com/open-telemetry/opentelemetry-js) | **IGNORE — for now** | Low | The current application does not need a full telemetry platform. Revisit only when measured production troubleshooting needs exceed simpler redacted logs and error monitoring. |
| 17 | Workflow, queues & notifications | [statelyai/xstate](https://github.com/statelyai/xstate) | **STEAL — next** | High | Model and test incident, report, paperwork, account, and retention transition graphs. Persist state and validate transitions on the server/database; do not let a client machine become the source of truth. |
| 18 | Workflow, queues & notifications | [pgmq/pgmq](https://github.com/pgmq/pgmq) | **STEAL/KEEP — architecture** | High | Confirms the existing Supabase Queues direction: durable Postgres-backed notification of work with sensitive payloads stored in authoritative tables, not queue messages. |
| 19 | Workflow, queues & notifications | [triggerdotdev/trigger.dev](https://github.com/triggerdotdev/trigger.dev) | **IGNORE — for now** | Low | Capable, but introduces another orchestration/control plane before Guided Operations has measured jobs that exceed the Vercel plus Supabase queue path. |
| 20 | Workflow, queues & notifications | [hatchet-dev/hatchet](https://github.com/hatchet-dev/hatchet) | **IGNORE — for now** | Low | Powerful durable workflow infrastructure, but operationally excessive for the current single-facility application and duplicates planned queue/worker boundaries. |
| 21 | Workflow, queues & notifications | [taskforcesh/bullmq](https://github.com/taskforcesh/bullmq) | **IGNORE** | Low | Would require a Redis operating surface and duplicate the Postgres queue already selected. |
| 22 | Workflow, queues & notifications | [timgit/pg-boss](https://github.com/timgit/pg-boss) | **IGNORE** | Low | A sound Postgres job runner, but adopting it alongside PGMQ would create two job abstractions and competing retry/visibility semantics. |
| 23 | Workflow, queues & notifications | [graphile/worker](https://github.com/graphile/worker) | **IGNORE** | Low | Another capable Postgres worker that would duplicate PGMQ and the repository's existing outbox/job-state direction. |
| 24 | Workflow, queues & notifications | [n8n-io/n8n](https://github.com/n8n-io/n8n) | **IGNORE** | Low | A general automation platform is a poor authority boundary for sensitive operational workflows and would add deployment, secret, audit, and licensing complexity. |
| 25 | Workflow, queues & notifications | [windmill-labs/windmill](https://github.com/windmill-labs/windmill) | **IGNORE** | Low | Useful as an automation platform, but too broad and duplicative for the narrowly controlled worker tasks this product needs. |
| 26 | Workflow, queues & notifications | [motiaDev/motia](https://github.com/motiaDev/motia) | **IGNORE — for now** | Low | Interesting unified backend workflow ideas, but replacing established Next.js server/DAL/job boundaries would add migration risk without solving an immediate gap. |
| 27 | Workflow, queues & notifications | [cerbos/cerbos](https://github.com/cerbos/cerbos) | **IGNORE — for now** | Low | An external policy decision service is unnecessary while the role model is intentionally small. Keep authorization in reviewed server helpers plus RLS; use CASL only for UI hints. |
| 28 | Workflow, queues & notifications | [open-policy-agent/opa](https://github.com/open-policy-agent/opa) | **IGNORE — for now** | Low | OPA is suited to broader policy estates. It would add policy language, deployment, debugging, and consistency burdens before the application's authorization model warrants them. |
| 29 | Workflow, queues & notifications | [novuhq/novu](https://github.com/novuhq/novu) | **BUILD — first-party first** | Medium | Borrow notification-center concepts, preferences, escalation, and delivery status. First implement an auditable Supabase-backed inbox; revisit an external multichannel engine only when email/SMS/push is approved and required. |
| 30 | Offline, scheduling & handover | [serwist/serwist](https://github.com/serwist/serwist) | **STEAL — pilot** | High | Use for installability, app-shell caching, safe update prompts, and controlled service-worker behavior. Do not broadly cache protected operational responses. |
| 31 | Offline, scheduling & handover | [dexie/Dexie.js](https://github.com/dexie/Dexie.js) | **STEAL — pilot** | High | Use for a narrowly scoped local draft/outbox with explicit expiry, logout purge, device boundaries, conflict handling, and no uncontrolled archive of inmate/incident data. |
| 32 | Offline, scheduling & handover | [schedule-x/schedule-x](https://github.com/schedule-x/schedule-x) | **STEAL — pilot** | Medium | Prototype staff/duty-position calendar views with Guided Operations data and styling before building a scheduler from scratch. |
| 33 | Offline, scheduling & handover | [fullcalendar/fullcalendar](https://github.com/fullcalendar/fullcalendar) | **IGNORE — backup option** | Low | Mature calendar core, but use only if Schedule-X fails the prototype. Confirm required staffing/resource/timeline features and their licenses before committing. |
| 34 | Offline, scheduling & handover | [neuronetio/gantt-schedule-timeline-calendar](https://github.com/neuronetio/gantt-schedule-timeline-calendar) | **IGNORE** | Low | A highly flexible timeline/Gantt surface is more complex than the initial duty-position scheduling requirement and risks turning the UI into a generic planning tool. |
| 35 | Offline, scheduling & handover | [josuman294/HandoverAI](https://github.com/josuman294/HandoverAI) | **BUILD — own handover** | Medium | Use only for workflow inspiration. Guided Operations needs a facility-specific, append-only shift handover tied to incidents, counts, tasks, acknowledgement, and audit history. |
| 36 | Offline, scheduling & handover | [telos-ai/logbook](https://github.com/telos-ai/logbook) | **BUILD — own logbook** | Medium | Borrow chronology and concise-entry concepts, but build an authoritative operational log with immutable revisions, classification, acknowledgements, and permissions. |
| 37 | Offline, scheduling & handover | [telos-ai/shiftpilot](https://github.com/telos-ai/shiftpilot) | **BUILD — own briefing** | Medium | Use as inspiration for assembling a shift briefing from verified events. Generated summaries must link back to source records and never replace them. |
| 38 | Offline, scheduling & handover | [iGnosis-Consulting/crosschecker-handover-tool](https://github.com/iGnosis-Consulting/crosschecker-handover-tool) | **BUILD — pattern only** | Low | Reference checklist and handoff-confirmation ideas; implement them inside the existing role, revision, and audit model. |
| 39 | Policy ingestion & retrieval | [docling-project/docling](https://github.com/docling-project/docling) | **STEAL — pilot** | High | Benchmark as the primary policy/document parser for PDF, DOCX, tables, and page-aware structured output. Run it in an isolated worker and retain immutable source/provenance hashes. |
| 40 | Policy ingestion & retrieval | [docling-project/docling-serve](https://github.com/docling-project/docling-serve) | **STEAL — deployment reference** | Medium | Use only if a service boundary is justified by measured ingestion load. Prefer a private worker or internal service, never a public document endpoint. |
| 41 | Policy ingestion & retrieval | [opendatalab/MinerU](https://github.com/opendatalab/MinerU) | **IGNORE — integration pending review** | Medium | Keep as a benchmark challenger for complex layouts, but do not embed or redistribute until its exact licensing and model/artifact terms are reviewed and documented. |
| 42 | Policy ingestion & retrieval | [Unstructured-IO/unstructured](https://github.com/Unstructured-IO/unstructured) | **IGNORE — unless needed** | Low | Broad and capable, but heavier than the current need. Reconsider only if Docling fails material source formats or layout cases in the benchmark. |
| 43 | Policy ingestion & retrieval | [Unstructured-IO/irs-manual-demo](https://github.com/Unstructured-IO/irs-manual-demo) | **STEAL — evaluation patterns** | Medium | Study the manual/policy corpus workflow, chunk inspection, and evaluation framing. Rebuild with the repo's citation, authorization, and no-fabrication constraints. |
| 44 | Policy ingestion & retrieval | [pgvector/pgvector](https://github.com/pgvector/pgvector) | **STEAL/KEEP — architecture** | High | Keep embeddings and vector search inside Supabase Postgres so authorization metadata, source provenance, and retrieval records remain close to the authoritative corpus tables. |
| 45 | Policy ingestion & retrieval | [pgvector/pgvector-node](https://github.com/pgvector/pgvector-node) | **IGNORE — unless direct SQL needs it** | Low | Add only if the server/worker needs direct Node Postgres vector bindings. Do not add a second abstraction if Supabase RPCs and the current Postgres client are sufficient. |
| 46 | Case management & domain references | [bitovi/carton-case-management](https://github.com/bitovi/carton-case-management) | **BUILD — pattern only** | Low | Study agent-friendly documentation and case workflow organization, but do not copy code: the repository is young and its metadata currently declares no license. |
| 47 | Case management & domain references | [tazama-lf/case-management-system](https://github.com/tazama-lf/case-management-system) | **BUILD — pattern only** | Medium | Study case assignment, review queues, activity history, and investigation-style navigation; translate only the patterns relevant to incidents and administrative review. |
| 48 | Case management & domain references | [Aam-Digital/ndb-core](https://github.com/Aam-Digital/ndb-core) | **BUILD — pattern only** | Medium | Useful reference for person/case directories, configurable records, and field workflows. Keep Guided Operations' correctional terminology and stricter source/revision controls. |
| 49 | Case management & domain references | [opencrvs/opencrvs-core](https://github.com/opencrvs/opencrvs-core) | **BUILD — pattern only** | Medium | Study public-sector registration workflows, review queues, corrections, auditability, and low-connectivity operation. Verify licensing before copying any implementation. |
| 50 | Case management & domain references | [nshdulal/Prison-Management](https://github.com/nshdulal/Prison-Management) | **IGNORE — domain code** | Low | Representative prison-management repositories are mostly small CRUD/student systems. They may provide vocabulary or a screen checklist, but not a safe security, audit, workflow, or data architecture foundation. |

### Architecture guardrails for every adoption

- **Server and database remain authoritative.** Client libraries may improve rendering, form state, or user feedback, but may not decide access or final workflow state.
- **No wholesale framework replacement.** Keep Next.js App Router, the existing DAL/server modules, Supabase, and the Guided Operations design language.
- **No uncontrolled local cache.** Offline support begins with app assets and narrowly scoped drafts/outbox records; logout, expiry, device loss, conflict, and purge behavior must be tested.
- **No silent AI authority.** OCR, classification, extraction, summarization, and policy answers retain provenance and require the current review/citation rules.
- **License before code.** A public repository is not automatically reusable. Carton currently has no declared license; MinerU and OpenCRVS metadata require further license review; FullCalendar feature licensing must be checked at the exact plugin/view level.
- **Use fictional data for development and demonstrations.** New dependencies and pilots must be qualified without real incident, staff, resident, policy-question, or credential data outside approved Production boundaries.

### Suggested implementation slices

#### Slice A — Shared operational table
Create one Guided Operations data-table component with server-driven pagination/filtering, explicit loading/empty/error states, column visibility, saved views only when authorized, accessible row actions, and no hidden-row counts that leak information. Convert `/reports` first, then administrator incident and audit lists.

#### Slice B — Shared form system
Create typed field primitives around React Hook Form and Zod: text, number, select, date/time, checkbox, officer picker, repeatable rows, field-level error announcement, autosave state, stale-revision recovery, and deliberate finalization. Convert one Daily Paperwork form before broader migration.

#### Slice C — UI authorization helper
Map server-supplied role/relationship facts into a small CASL ability object. Use it to hide or disable unavailable actions and explain denials, but call the server for every read/mutation and continue negative RLS/server tests.

#### Slice D — Notification and handover foundation
Add authoritative tables for notifications, recipient scope, source record, severity, acknowledgement, due/escalation time, delivery attempts, and audit events. Build the in-app inbox and shift handover on this foundation before considering email/SMS/push providers.

#### Slice E — Offline draft proof
Select one non-final incident-draft workflow. Cache only the minimum form state, encrypting transport and relying on device/session controls rather than claiming browser storage is a secure archive. Require explicit reconnect review before upload, detect base-revision conflicts, purge after successful sync/logout/expiry, and test interrupted uploads and browser updates.

#### Slice F — Policy ingestion benchmark
Create a repeatable corpus fixture containing native PDFs, scans, DOCX, tables, headers/footers, multi-column pages, and attachments. Compare parsers using page-level ground truth, then store immutable parser/model/version/configuration provenance with each derived artifact.

### Final recommendation

The next engineering work should begin with **TanStack Table + React Hook Form + CASL UI predicates**, followed by the **first-party notification/activity model**. Those changes improve nearly every current surface without destabilizing the architecture. The first three prototypes after that should be **Uppy attachments, pdfme form fidelity, and Schedule-X staffing views**. Offline drafts and policy ingestion should remain separate, security-reviewed experiments until their acceptance tests pass.

---

This is an engineering/product recommendation, not a certification that any dependency or resulting system satisfies agency, records, privacy, security, accessibility, or criminal-justice requirements. Exact package versions and licenses should be rechecked when an implementation PR is opened.
