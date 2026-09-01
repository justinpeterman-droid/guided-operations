# Guided Operations UX Contract

This contract records observable cross-screen behavior. Visual intent and token
values belong in `DESIGN.md`; product, permission, workflow, retention, and
safety rules remain authoritative in the linked product documents.

## Product context

- Audience: correctional officers and administrators at one configured facility.
- Primary jobs: review-first report preparation, authorized policy consultation,
  approved forms and Count Sheet work, and protected administration.
- Target market: one United States facility.
- Active locale: `en-US`.
- Language/content register: plain, calm operational English; owner review
  governs consequential wording.
- Timezone/calendar policy: facility-configured timezone and Gregorian calendar;
  technical timestamps are never presented as event facts.
- Accessibility target: WCAG 2.2 AA, 320px CSS width, 200% and 400% zoom,
  reduced motion, and keyboard completion.

## Business-context sources

| Domain / scope                                         | Authoritative source                                                             | Source type                 | Reviewed date |
| ------------------------------------------------------ | -------------------------------------------------------------------------------- | --------------------------- | ------------- |
| Product and environment boundary                       | `PRODUCT.md`                                                                     | Product contract            | 2026-08-31    |
| Experience direction                                   | `docs/product/experience-design-brief.md`                                        | Owner-approved design brief | 2026-08-31    |
| Permission model                                       | `docs/product/roles-and-permissions.md`                                          | Permission policy           | 2026-08-31    |
| Workflow, output, citations, persistence, and recovery | `docs/product/workflow-and-report-safety.md`                                     | Safety invariants           | 2026-08-31    |
| Retention and legal holds                              | `docs/operations/real-data-governance.md` plus approved retention implementation | Governance contract         | 2026-08-31    |

## Visual contract

- Project design context: `DESIGN.md`.
- Token ownership model: existing runtime tokens remain canonical.
- Runtime source: the `:root` `--gow-*` variables and shared component rules in
  `src/app/globals.css`.
- Mapping: `DESIGN.md` mirrors accepted runtime values and explains their roles.
- Drift gate: design-context lint, premium static audit, changed-token search,
  component tests, and desktop/mobile browser comparison.
- Supported theme: light only.
- Review policy: durable visual changes require synchronized documentation,
  runtime changes, and owner-visible evidence.

## Canonical UI Map

| Capability      | Canonical owner                                                                                             | Source of truth                                | Allowed variants                                                 | Verification                                 |
| --------------- | ----------------------------------------------------------------------------------------------------------- | ---------------------------------------------- | ---------------------------------------------------------------- | -------------------------------------------- |
| Table Selection | Not currently applicable; no bulk row-selection workflow is approved                                        | Product workflow                               | None until approved                                              | Route and authorization tests                |
| Select/Listbox  | Native HTML `select` for current internal forms; operating-system popup geometry is accepted                | This contract plus labeled semantic controls   | Native                                                           | Keyboard, label, and popup browser checks    |
| Date            | Native HTML date input for current `en-US` internal forms; facility policy owns displayed operational dates | This contract plus domain validation           | Native                                                           | Keyboard, locale, validation, and E2E        |
| Form            | Semantic HTML form plus screen-owned schema/state adapter following the shared validation rules below       | This contract and server/domain validation     | Create, edit, step-up, and read-only                             | Component and validation E2E                 |
| Scrollbar       | Global application stylesheet                                                                               | `DESIGN.md` and `src/app/globals.css`          | Stable-gutter or table-surface geometry exception                | Computed style and narrow-browser check      |
| Toast           | Not currently used; persistent inline status/live regions are canonical                                     | This contract                                  | Information, success, warning, and error inline status           | Live-region component test                   |
| CRUD            | Server-authorized route/service behavior with base revision and idempotency where required                  | Product safety invariants and server contracts | Return-to-owner or remain-and-confirm when explicitly documented | Full-flow E2E and direct-access denial tests |

## Component behavior

| Component         | Default                                                                                           | Hover                             | Focus                                              | Active                              | Disabled                                  | Busy                                                        | Error                                                |
| ----------------- | ------------------------------------------------------------------------------------------------- | --------------------------------- | -------------------------------------------------- | ----------------------------------- | ----------------------------------------- | ----------------------------------------------------------- | ---------------------------------------------------- |
| Button/link       | Clear label and 44px important target                                                             | Visible emphasis without movement | 3px token focus ring                               | Pressed treatment                   | Legible, no handler, explain when unclear | Stable dimensions and `aria-disabled`/native disabled state | Inline recovery remains present                      |
| Icon button       | Accessible name and tooltip when needed                                                           | Visible background/border change  | Token focus ring                                   | Pressed treatment                   | Legible and inert                         | Stable geometry                                             | Associated message                                   |
| Input/select/date | Visible persistent label                                                                          | Border emphasis                   | Token focus ring                                   | n/a                                 | Legible and unavailable                   | Preserved value                                             | `aria-invalid`, described text, correction hint      |
| Secret input      | Masked                                                                                            | n/a                               | Field and reveal control are independently visible | Reveal button exposes pressed state | Reveal and field are inert                | Value remains masked unless explicitly revealed             | Secret never enters URL, logs, toast, or screenshots |
| Search            | Clear button when non-empty                                                                       | Visible                           | Token focus ring                                   | Clear returns focus to search       | Reason exposed                            | Stale work cancelled                                        | Existing results remain recoverable                  |
| Textarea          | Sufficient default height, resize disabled, auto-grow or expansion where long content is expected | Border emphasis                   | Token focus ring                                   | n/a                                 | Legible                                   | Visible content preserved                                   | Inline described error                               |
| Table/list        | Semantic rows and headings                                                                        | Row/action emphasis               | Every control visible                              | Selection only when approved        | Unavailable action explained              | Stable loading footprint                                    | Error does not erase recoverable content             |

## Dataset navigation

- Administrator tables use bounded server pagination when result counts can
  grow.
- Current small operational lists may use bounded server results with an
  explicit count; unbounded lists are not acceptable.
- Committed non-sensitive search, filters, sort, page, and page size belong in
  URL state. Policy questions, report narratives, personnel data, and other
  sensitive content never enter URL state.
- Empty, no-results, loading, partial-error, and unavailable states retain the
  surrounding page geometry and name the next safe action.
- Back navigation restores safe list context where practical without persisting
  sensitive form content in the URL.
- Bulk selection is not approved. Adding it requires an explicit scope,
  selected-count, authorization, confirmation, and post-action-focus contract.

## Flow ledger

| Operation                          | Trigger                                                 | Pending                                                            | Success destination                                      | Success feedback                          | Failure recovery                                                              | Focus outcome                              | Source ref                           |
| ---------------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------ | -------------------------------------------------------- | ----------------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------ | ------------------------------------ |
| Sign in                            | `Sign in`                                               | Disable duplicate submit; stable `Signing in…` label               | Intended authorized page or officer home                 | Destination identity is visible           | Generic inline error; employee number preserved; passcode handled as a secret | Error summary/form or destination heading  | Roles and permissions                |
| Create incident                    | `Start a report` / create action                        | Preserve entered notes; mark unsaved/saving truthfully             | New incident workspace                                   | Server-confirmed state only               | Retain visible input and offer retry/recovery                                 | First actionable workspace heading/control | SAFE-010–023, SAFE-070–083           |
| Edit/confirm                       | Explicit save or confirm action                         | Prevent duplicate submit; preserve base revision                   | Remain in owning workflow unless contract says otherwise | `Saved to server` or confirmed revision   | Conflict keeps local work and provides compare/copy/reopen                    | Status or first error                      | SAFE-012, SAFE-071–083               |
| Generate draft                     | Deliberate generation action                            | Pin input revision; show bounded progress                          | Draft review                                             | Draft label and provenance remain visible | Existing human edits and inputs remain recoverable                            | Draft heading or error recovery            | SAFE-030–036                         |
| Ask policy                         | Deliberate question submit                              | Question remains visible; prevent duplicate request                | Same policy workspace                                    | Answer and citations render together      | Clear no-answer/unavailable state; no uncited polished answer                 | Answer heading or error                    | SAFE-060–067                         |
| Print/download/copy                | Explicit named output action                            | Preserve page state                                                | Same workspace or browser-owned output surface           | Output-specific acknowledgment            | Partial success is explicit; no false completion                              | Trigger or status                          | SAFE-035–046, SAFE-083               |
| Save Count Sheet                   | Explicit or approved autosave action                    | Preserve blank/zero distinction and current input                  | Same sheet                                               | Server-confirmed revision/save state      | Conflict and retry preserve visible cells                                     | Save status or first invalid cell          | SAFE-050–053, SAFE-070–083           |
| Administrator consequential action | Explicit named action plus fresh step-up where required | Lock duplicate submit; retain object/consequence                   | Owning admin surface                                     | Bounded attributed result                 | Safe failure without secret or sensitive body                                 | Confirmation heading, result, or trigger   | SAFE-090–103 and roles policy        |
| Hard deletion/legal-hold release   | Named action in app-owned alert dialog                  | Least-destructive initial focus; irreversible consequence repeated | Owning retention surface                                 | Audited bounded result                    | No state change on uncertain/failure response                                 | Result or restored trigger                 | Governance contract and SAFE-070–103 |

## Navigation and responsive behavior

- Route document titles use a page-specific name through the root
  `Guided Operations` template.
- Direct unauthorized access is denied by server/database enforcement. The UI
  does not treat hidden navigation as authorization.
- Officer and administrator navigation remain visibly distinct; administrator
  entry never grants product permissions by presentation alone.
- Mobile layouts stack into one natural document flow. Menus or drawers must
  preserve focus order, dismissal, and return focus if introduced.
- Read-oriented tables stay semantic. Spreadsheet-like Count Sheet controls own
  their horizontal scroll surface and provide a visible cue on narrow screens.
- Truncated authorized values provide an accessible way to read or copy the full
  value; secrets and sensitive bodies do not.
- Sticky UI must not cover focused controls, error messages, or zoomed content.

## Overlays and feedback

- Consequential confirmations use an app-owned accessible dialog/alert-dialog
  with title, consequence, least-destructive initial focus, Escape behavior, and
  focus restoration.
- Routine reversible saves do not ask for confirmation.
- Persistent inline status is preferred because operational feedback must remain
  available; any future toast is supplemental and uses one shared live-region
  system.
- Unsaved in-app navigation uses an app-owned confirmation. The browser unload
  mechanism is reserved for actual page unload.
- Layer order is documented when the first shared overlay primitive is
  introduced; screen-local z-index escalation is not allowed.

## Async and resilience

- Protected writes are pessimistic unless an authoritative workflow explicitly
  permits optimism.
- Consequential mutations prevent duplicate submit and use server idempotency
  where the safety contract requires it.
- Save language is limited to Unsaved, Saving, Saved to server, Reconnecting,
  Conflict, and Save failed.
- Dependency failure never clears visible notes, edits, answers, or routine
  paperwork.
- Automatic retry is limited to safe/idempotent work with bounded backoff.
  Authorization, validation, and conflict errors require user action.
- Base-revision conflict preserves local work and provides copy/compare/reopen
  recovery.
- Session expiry preserves safe recoverable input, returns through sign-in, and
  never places protected content in the URL.
- Superseded search or retrieval work is cancelled or ignored so stale results
  cannot overwrite current intent.

## Validation

- Server/domain validation is authoritative. Client validation improves
  correction speed without weakening server checks.
- Product forms use `noValidate` when they provide complete application-owned
  inline feedback; migration must not remove useful constraint metadata.
- Errors use text, remain associated through `aria-describedby`, set
  `aria-invalid`, preserve values, and move focus to the first invalid field or
  form summary after submit.
- Submit buttons prevent duplicates and preserve dimensions while busy.
- Secret inputs are masked by default and include a labeled reveal control.
  Secret values never enter URLs, analytics, logs, toasts, or persistent client
  storage.

## Permission and clipboard

- Navigation and ordinary actions that the role can never use may be hidden to
  reduce confusion. Temporarily unavailable actions remain visible and disabled
  with a reason. Direct access always receives server-enforced denial or the
  approved safe redirect.
- Clipboard actions use an explicit button, accessible result announcement, and
  no secret or sensitive value in toast text.
- Role, facility scope, incident relationship, account state, and administrator
  step-up remain server/database decisions.

## Migration status

- Migration ledger: the active Codex plan and changed-file evidence for
  `codex/ui-refinement` until a repository-owned ledger is needed.
- Canonical runtime owner: `src/app/globals.css` plus shared React components.
- Current sequence: foundations/public auth; officer workflows; forms/Count
  Sheet; administrator workflows; qualification.
- Screen-local fixes are acceptable only when the behavior is genuinely unique.
  Recurring behavior moves to a shared owner.
- No big-bang CSS rewrite, framework migration, or authorization/workflow change
  is part of the UI refinement.

## Verification

- Static: format check, lint, typecheck, unit/component tests, premium strict
  audit, anti-pattern search, build.
- Browser: public and fictional preview routes at desktop, 390px, 320px, 200%
  zoom, keyboard, and reduced motion.
- Authenticated browser: repository local-auth qualification using fictional
  accounts only.
- Accessibility: axe/WCAG checks plus keyboard focus, announcements, touch
  targets, zoom, and table overflow review.
- Visual regression: before/after evidence for landing/login, officer home,
  report workspace, policy, forms, Count Sheet, admin, retention, and paperwork
  packages.
- Safety: fictional-data, authorization denial, persistence-language, citation,
  print/output, and recovery tests from the maintained safety pack.
