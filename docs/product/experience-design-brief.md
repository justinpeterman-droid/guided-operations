# Guided Operations Experience Design Brief

- **Status:** Owner-approved design direction
- **Approved:** 2026-08-27
- **Applies to:** Officer Home, Policy Expert, report workflows, shared product
  shell, and future administrator command-center work
- **Implementation reference:**
  `src/app/components/workspace-command-center.tsx` and the related rules in
  `src/app/globals.css`

## Expert website design pass - 2026-09-05

Completed locally after the workflow audit. This pass used the design-critique
and shadcn skills, the current 32-route inventory, rendered officer and
administrator pages, and the existing fictional previews. The design direction
remains calm blue-gray, with the same priority for Report Assistant and Policy
Expert. No new product capabilities or record authorities were introduced.

| Finding                                                                                                                        | Implemented improvement                                                                                                                                                                                                                                                   |
| ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Home's compact sans-serif headings contrasted with oversized serif headings on working pages.                                  | Applied a consistent screen-only heading scale and spacing to Reports, Account, Forms, Policy Expert, incident steps, administrator pages and previews. Daily source-package headings now follow the same scale.                                                          |
| The solid suggestion button competed with the page's primary task.                                                             | Reused shadcn Button with its outline variant and a decorative message icon. Form-request actions use the same secondary treatment. Dialog behavior, target selection, discard protection and focus return are retained.                                                  |
| Policy Expert devoted a large side panel to a reminder and nested the question inside another panel.                           | Replaced the side panel with a compact shadcn Alert below the question form and before any answers. The question has more usable width, readable sans-serif labels and a full-width submit action on phones. All citation and verification guidance remains visible.      |
| Reports search gave no indication of how many loaded records matched; readable report names did not match internal type codes. | Added shadcn Field, Input and Button, live counts of matching versus loaded incidents/reports, readable report-type search, and a Clear search action that returns keyboard focus to the field. Filtering remains confined to server-authorized summaries already loaded. |
| Empty search results, status pills and tables lacked consistent treatment.                                                     | Added shadcn Empty and Badge, calmer table borders, larger row text, readable links with 44px targets, named keyboard-focusable scroll regions and a phone-width horizontal-scroll hint. Exact incident identifiers and revisions remain visible.                         |

The new shadcn components were added from the official registry and reviewed.
Imports use the existing local `cn` utility; the CLI's redundant `cn` package
was removed. Existing customized components were preserved. Alert titles wrap
instead of being truncated on small screens. Tailwind remains scoped to migrated
surfaces. Count Sheet totals, flags, unit labels, calculations and print layout
retain the owner's approved treatment; document print typography is unchanged.

### Design verification

- Reviewed officer Home, Reports, Forms, Policy Expert, suggestions/list/intake,
  Account, incident entry and the administrator/retention/source-package/Count
  Sheet previews at 1280px and 390px. No document overflow or unhandled browser
  errors were observed. The officer checks also monitored console and failed
  requests. Populated Reports used existing unmistakably fictional incidents.
- Rechecked the protected administrator overview, accounts, activity, health,
  suggestions, retention and daily-paperwork surfaces at both widths using an
  existing fictional administrator. Health still shows its unavailable state;
  local source-package registration remains deliberately gated with 404.
- Automated mobile WCAG A/AA checks passed on signed-in Reports, Policy Expert,
  Forms, suggestions and Account. Real-browser keyboard checks covered search,
  no results, clearing with focus return, scrolling the table, and opening and
  dismissing the suggestion dialog with focus restored to its trigger.
- **832 application tests passed, one skipped.** Formatting, ESLint, TypeScript,
  production build and Git whitespace checks passed. **30 UI browser tests
  passed**, covering preview accessibility, navigation, reflow, Count Sheet and
  output guards.
- GitHub's Linux browser run exposed a 4px overflow in Home's review path at
  320px. Reduced the small-screen gaps and added a wider-font regression check;
  the regression reproduced 324px before the fix and 320px afterward. Both the
  targeted regression and the existing mobile preview-route checks passed
  locally.
- The next Linux run passed all 28 public browser checks and the two protected
  officer checks. The report-workspace scenario still assumed immediate editing
  after a correction save. Updated it to assert the saved form is locked, follow
  Open updated report, and then exercise the existing stale-revision conflict.
- PR review follow-up restored the suggestion-card keyboard focus ring, included
  totals and the current highlight action in Count Sheet accessible names, and
  fixed report-history timestamps to explicit UTC. Reply session-expiry recovery
  now preserves text and offers separate-tab sign-in at either 401 boundary.
  Sixteen focused tests and four Count Sheet browser checks passed; the policy
  expiry test now specifically exercises the answer endpoint after valid CSRF.
- An unfiltered browser-suite invocation also selected the separate protected
  qualification suites. Seven stopped at missing `NEXT_PUBLIC_SUPABASE_URL`
  qualification setup and three dependent tests did not run. They did not reach
  account provisioning. This is not a passing full protected qualification run;
  the existing-account visual checks above are separate evidence. Earlier
  provider, populated-report and approved-source limitations remain as recorded
  in the audit below.

No records, feedback, uploads or identities were created in this design pass.
Changes are submitted in PR #46. The next functional work remains the ordered
backlog below; the design pass does not claim durable draft recovery or new
service capabilities.

## Officer workflow audit - 2026-09-05

The next pass followed a new officer through incident entry, fact review,
saving, opening the saved record, counts, Forms navigation and Policy Expert.
The highest-impact findings were silent loss when changing tools, unconfirmed
save outcomes, and no clear recovery when a session expired.

Implemented and reviewed locally:

- Unsaved incident and Count Sheet entries now prompt before following a
  same-tab link or refreshing/closing the document. Cancel preserves the entered
  values. Count Sheet also confirms its explicit discard/reload action. New-tab
  links, downloads, and same-page anchors remain usable.
- Incident entry explicitly says it is not saved until the final review step.
  The form and workflow navigation cannot be edited while saving is in flight.
- A confirmed save opens a success screen with the incident identifiers and an
  **Open saved incident** action. The create/save controls are no longer shown,
  removing the repeat-create action and the search through Reports afterward.
- Retrying the same unchanged incident uses the exact prior request body and
  idempotency key. A lost response is described as unconfirmed, rather than
  incorrectly claiming nothing changed. Changed reviewed content produces a new
  request. Authorization and server-side idempotency remain unchanged.
- Incident and Count Sheet saves recognize expired-session responses and offer
  **Sign in again (opens a new tab)**. Entries stay in the original tab while
  the officer signs in and then deliberately retries.

Browser evidence includes canceling tool navigation and refresh, canceling Count
Sheet reload, deliberately leaving after confirmation, and mobile
expired-session recovery using a simulated 401. A real local fictional incident
save was deliberately interrupted after the server accepted it; the unchanged
retry recovered the same saved incident and opened Document Studio. Policy
Expert's local unavailable result retained its question. The new save-success
screen was visually reviewed at 1280px and 390px. Screenshots and helper scripts
remain outside the repository under the parent workspace.

Protection limits: this is not autosave or durable draft recovery. Browser
crashes and forced termination can still lose unsaved entries. Back/Forward
protection now uses the browser's Navigation API when a same-document traversal
is cancellable; unsupported browsers and noncancellable traversals remain a
limit. The browser can allow repeated Back attempts to escape cancellation. No
history entries are fabricated or rewritten. Document-exit prompts remain
browser-controlled. See the
[HTML navigation-event cancellation rules](https://html.spec.whatwg.org/multipage/nav-history-apis.html#the-navigate-event).
No private form values are placed in browser storage. Populated report
generation and other unavailable service states retain the earlier limits.

Validation for this follow-up: 803 Vitest tests passed (one skipped), 69
operations tests passed, and 23 accessibility/navigation/Count Sheet browser
tests passed. Full lint, typecheck, formatting, build, and whitespace checks
passed. The additional local browser walkthroughs exercised the protected
officer session and the recovery scenarios described above.

### Prioritized functional findings and outcomes

The continuation reviewed the complete officer journey against the existing page
inventory below. Priority 1 covers lost work, incorrect save outcomes, or
revision safety. Priority 2 covers blocked controls and recovery/accessibility
barriers. Improvements are implemented locally; the service-dependent states
listed below are not represented as end-to-end verified.

| Priority | Officer difficulty                                                                                         | Outcome                                                                                                                                                                                                                                                                                                                     |
| -------- | ---------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1        | Changing tools, refreshing, or using Back/Forward silently loses unfinished work.                          | Shared leave protection now covers incident entry, Count Sheet, report correction/finalization, form requests, unsent feedback, and a pending policy question. Real-browser Back and Forward cancellation preserved incident identifiers. Browser limits are stated above.                                                  |
| 1        | An interrupted save leaves the officer unsure whether to submit again.                                     | Incident, Count Sheet save/restore, and report correction/finalization reuse the same body and key for an unchanged retry. UI describes uncertain outcomes honestly. A changed request receives a new key; server authorization, replay checks, and revision concurrency remain intact.                                     |
| 1        | Text remains editable while a save/send is running and may disappear or differ from the submitted version. | Report editors, form requests, feedback replies, and the suggestion panel lock the submitted fields while pending. Failures retain text. Final narrative edits clear the earlier review checkbox so the revised text must be reviewed again.                                                                                |
| 1        | Restoring or reviewing Count Sheet history can conflict with unsaved counts or concurrent sheet actions.   | History actions wait until counts are saved or deliberately discarded. Count entry, date changes, save, reload, and print wait while a history action is pending. Existing append-only restoration remains unchanged.                                                                                                       |
| 1        | A refreshed report can advance the correction's base revision without deliberate review.                   | A correction keeps its original base revision. If refreshed props show a newer report, unsaved text remains visible and submission stops until the officer reloads/reviews the current report. A confirmed save cannot be submitted again from the same editor.                                                             |
| 2        | Clearing the Work date disables the date input indefinitely.                                               | The date selector remains editable when blank. An explicit **Load date** action loads a complete selection; **Cancel date change** returns to the current date. Counts and print stay disabled while a different date is selected, and the sheet date/shift remain visible. Failed loads also allow another date selection. |
| 2        | Expired sessions leave filled forms with an unhelpful generic error.                                       | Incident, Count Sheet save, report editors, Policy Expert, and form-request intake explain that entries remain and link to sign-in in a separate tab. No credentials, session rules, or data storage changed.                                                                                                               |
| 2        | Keyboard focus escapes the suggestion modal, and closing it discards text without warning.                 | The panel uses the installed Radix dialog primitive for focus containment, Escape handling, and return focus. Closing asks before discarding an unsent description; closing and editing are disabled during submission. Point-to-page selection still works.                                                                |
| 2        | After saving an incident, it is unclear where to continue.                                                 | The earlier save-success screen names the incident and opens its saved Document Studio directly. Category labels/search and tool navigation improvements from the completed UI pass remain in place.                                                                                                                        |

Additional evidence from this continuation:

- Reproduced the blank-date lock and silent browser Back loss before changing
  code. Verified blank-date recovery, cancel, keyboard date loading, and Back
  **and** Forward cancellation after the changes at the real local app.
- Reviewed Count Sheet and suggestion panel screenshots at 1280px and 390px.
  Verified suggestion Tab containment, Escape cancel/confirm, focus return, and
  point-to-page selection. No unhandled page errors occurred.
- Used simulated expired-session responses after authorized pages loaded to
  verify form-request and Policy Expert recovery on a phone viewport. No
  feedback request or message was sent.
- Component regressions cover interrupted report saves, unchanged replay,
  expiration, field locking, renewed attestation after edits, changed Count
  Sheet retry keys, unsaved-count history protection, and report refresh
  conflicts. Populated report editors and feedback conversations could not be
  reached through the current authorized local services/fixtures, so these paths
  retain component-level evidence rather than a claimed live save.
- Final suite: 818 Vitest tests passed (one skipped), 69 operations tests
  passed, and all 30 preview/accessibility/output-guard browser tests passed.
  Formatting, lint, typecheck, production build, and git whitespace checks
  passed. The final report-refresh safeguard passed its eight targeted tests,
  followed by the full Vitest suite and production build. Protected browser
  walkthroughs above supplement the public/preview browser suite.

### Audit completion and next improvements - 2026-09-05

The audit document is complete for this local pass. It now separates implemented
fixes, the evidence available for each, and implementation work still to do. The
earlier route inventory remains the coverage record; this continuation
concentrated on its unresolved recovery and history findings.

Completed in this continuation:

| Finding                                                                                                                           | Change                                                                                                                                                                                                                                                                                                                          | Evidence                                                                                                                                                                                                                                                                                |
| --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| UI-01: reviewing old counts requires remembering the current values                                                               | **Compare saved versions** lists only changed fields, with current and reviewed revision numbers. Blank and zero remain distinct. Returning to the current sheet removes the comparison without changing counts. Comparison is excluded from print.                                                                             | Unit and workspace integration tests; actual comparison component reviewed at 1280px and 390px in an isolated fictional browser fixture.                                                                                                                                                |
| UI-02: report restore can be submitted repeatedly or edited while pending                                                         | Restore locks its controls, preserves an unchanged request/key for retry, validates the returned revision, clears a confirmed restore, waits for the refreshed current revision, and provides session recovery. Revision timestamps are visible.                                                                                | Component regressions and a real-browser fixture exercising keyboard submission, pending state, failed response and identical retry.                                                                                                                                                    |
| UI-03: a lost upload or verification response strands the form request                                                            | Retry checks a known request's existing upload before sending another file. Server recovery recognizes an already verified upload only for its owner and facility while unexpired and with matching recorded integrity metadata. An uncertain PUT is followed by authenticated byte verification; it never permits replacement. | Lost-PUT and lost-finalization client tests; route authorization, integrity, missing-object and replay tests; constrained-query test; actual protected local missing-upload lookup returned 404; interrupted upload recovery exercised in the real intake page with intercepted writes. |
| UI-04: retries lose request identity or associate edited content with the old request                                             | Form intake and page suggestions reuse the original nonce/body when unchanged. Edited content starts a separate request. Intake exposes a separate-tab link to the known request and explains this distinction. Closing/discarding a suggestion ends that request attempt.                                                      | Nonce/body regression tests and the intercepted intake walkthrough. No feedback was sent.                                                                                                                                                                                               |
| UI-05: populated history and report editors are poorly spaced, and a textarea's accessible name can include its initial narrative | Report history uses existing shadcn buttons, spaced revision cards and readable timestamps. Shared report inputs have consistent spacing and sizing. Explicit narrative label references give each editor a stable accessible name.                                                                                             | Desktop/mobile screenshots of the actual components with the app's current stylesheet; keyboard and exact accessible-name checks.                                                                                                                                                       |

The comparison/restore/editor browser fixture imports the actual components; it
does not stand in for successful protected report generation or a live restore.
The upload walkthrough intercepts create/PUT/finalize writes; only the expected
missing-candidate lookup reached the local server. No feedback record, upload,
report, count revision, or identity was created in this continuation. The
existing database schema and applied migrations were not changed.

#### Ordered implementation backlog

These are remaining product tasks, not unfinished wording in this document. Each
has a concrete starting point and completion condition.

| Order | Work item                                                              | State                                                                         | Start here                                                                                                   | Completion condition                                                                                                                                                                   |
| ----- | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | DRAFT-01: durable incident draft and Home resume                       | Design specified below; implementation not started                            | Incident input state, protected incident save contract, Home's existing work list, and the records inventory | A fictional officer can deliberately save, close the browser, sign in and resume exact unreviewed input; another officer cannot read it; promotion remains a separate reviewed action. |
| 2     | HISTORY-01: report-version comparison                                  | Count Sheet comparison completed; report comparison remains                   | Report-history UI, current-report reader and revision-list service                                           | Read-only comparison of two explicitly numbered, authorized versions works for every supported report type and never enables an otherwise unavailable print/download action.           |
| 3     | FEEDBACK-01: reply deduplication and cross-session upload continuation | Same-tab intake/suggestion retry completed; remaining server contracts needed | Improvement message endpoint, create nonce contract, intake and request-detail views                         | A lost reply response cannot create a duplicate, and an officer can resume an eligible incomplete upload from request details after reopening the browser.                             |
| 4     | VERIFY-01: provider/source-dependent workflows                         | Coverage limits remain explicit                                               | Authorized fictional qualification fixtures, configured local providers and approved source packages         | The workflow matrix below passes through protected routes without mock outcomes or relaxed access/source checks.                                                                       |

#### DRAFT-01 implementation contract

Build this as a separate draft lifecycle, with **Save draft** and **Resume
draft** first. Add bounded autosave only after explicit save/resume and recovery
pass their checks. The existing migration plan calls for deciding autosave
requirements; the current UI does not claim that they exist.

1. Define a versioned draft envelope for the incident identifiers, officer
   relationships, dates/location/category, exact source notes, proposed facts,
   explicit unknowns and working review state. Exclude session tokens, signed
   URLs and provider credentials. Resume must revalidate account/relationship
   authority and require current deliberate review before creating confirmed
   facts or a report. A remembered checkbox is not new approval.
2. Add a forward migration for private draft ownership, facility, schema
   version, optimistic revision, lifecycle state, timestamps and any
   promoted-incident reference. Add narrow save/read/list/discard/promote
   services with current-session checks and default-deny grants/RLS. Draft
   summaries must omit narrative and fact bodies.
3. Define draft retention/discard in the records inventory and accepted design
   record before enabling storage. The existing two-year retention and legal
   hold rules still govern production records and controlled copies; do not
   invent a short automatic purge exception. UI discard must not promise
   physical deletion while a hold or retention requirement applies.
4. Connect explicit save/resume to the six-step workspace. Show **Unsaved**,
   **Saving**, **Draft saved**, **Save not confirmed**, or **Conflict** based on
   acknowledged state. Keep last acknowledged revision and unchanged retry
   identity. A late response must not overwrite newer typing.
5. Add a draft item to Home's existing work list with the official incident
   number/name when entered, last acknowledged save time and a clear resume
   action. Missing identifiers need honest placeholders. Keep drafts visually
   distinct from confirmed incidents and reports.
6. Make promotion to the existing incident workflow idempotent and deliberate.
   Record the linked incident only after a confirmed save. Reopening or retrying
   must recover that same result and cannot create a second incident.

Required acceptance tests: exact notes/blank/zero round-trip; restart and
re-authentication; two-tab stale revision conflict; lost response replay;
revoked/disabled account; cross-owner/facility denial; changed schema handling;
renewed review after material edits; retention/hold behavior; no draft content
in logs or browser storage. Rollback disables new draft writes/resume entry
points while preserving stored drafts for controlled recovery.

#### HISTORY-01 implementation contract

The existing report revision list returns metadata. The explicit-version export
reader is limited to printable report types; it must not be repurposed as a
shortcut for copy-only narratives.

Add a narrowly authorized read contract for an explicit report revision,
including copy-only types, with no output/audit mutation merely for comparing.
Validate identifiers, ownership/facility and revision bounds. Fetch only the two
versions deliberately selected. Display revision numbers, timestamps and plain
read-only text; preserve exact narrative bytes and distinguish a changed
paragraph from absent text. Keep restore and any manual correction separate.

Acceptance: same-version/no-change, additions/removals, long narratives, missing
and unauthorized versions, server error recovery, keyboard/mobile reading, and
unchanged print/download capability rules. No automatic merge or restoration.
Rollback can hide comparison without changing existing reports or history.

#### FEEDBACK-01 implementation contract

The completed intake recovery works while the selected file and request attempt
remain in the current tab. After a browser restart there is no retained file.
The reply endpoint still lacks a client-supplied message nonce; page-suggestion
deduplication does not imply reply deduplication.

- Add a request-bound, author-bound reply nonce and canonical body check under a
  narrow transactional server contract. Test identical replay, changed-body
  conflict, simultaneous sends, revoked access and cross-request denial before
  offering a retry that claims deduplication.
- Show an incomplete upload on its authorized request-detail page. Ask the
  officer to reselect the same blank file when bytes are needed, compare its
  name/type/size/hash with the original declaration, and request fresh upload
  authority only after ownership, facility, state and expiry checks.
- A verified upload can recover its existing result; rejected, expired,
  unauthorized or mismatched files must not be replaced or published. Creating a
  different request remains explicit. Keep reviewer approval separate from
  upload verification.

Acceptance: lost create, PUT, finalization and reply responses; session
expiration; browser restart; mismatched file; duplicate object; expired upload;
no repeated status/message side effects. Rollback removes continuation/retry
affordances while retaining existing request records and quarantined files.

#### VERIFY-01 protected workflow matrix

| Workflow                                                  | Available evidence                                                                       | Still required                                                                                                                               |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Incident entry, fact review, save/reopen                  | Protected local fictional walkthrough and lost-save replay from the prior pass           | Recheck when incident/draft storage or review contracts change.                                                                              |
| Generated candidate, finalized report, correction/history | Unit/service checks; actual populated component browser fixtures for editors and restore | Protected generation-to-finalization-to-correction/restore with a working authorized fictional provider fixture.                             |
| Exact-version print/Word and copy-only reports            | Existing regression/output-denial tests and preview print checks                         | Authorized populated output for each supported type/version, visual fidelity and recorded deliberate output.                                 |
| Policy question and source                                | Protected unavailable/session recovery; fictional citation preview and source-link tests | Authorized sourced-answer/source-reader journey with an approved immutable local source; unsupported questions must still decline.           |
| Forms and Daily Paperwork                                 | Forms navigation; approved Count Sheet UI/calculation; missing-source states             | Approved local source packages before each Daily Paperwork editor/output check. No substitute operational template.                          |
| Suggestions, upload and reply                             | Modal/intake browser checks; mocked recovery; authorized missing-upload SQL lookup       | Isolated authorized fixtures for a populated conversation and complete upload/reply round trip; no live reviewer messages during this audit. |

Retain the earlier administrator/forced-passcode/health limitations in the route
inventory. They do not block the document's completion and are not presented as
verified merely because their page or unit tests render.

#### Final validation for this continuation

- Application tests: **832 passed, 1 skipped**. Operations checks: **69
  passed**.
- Preview, accessibility and output-guard browser suite: **30 passed**.
- Formatting, ESLint, TypeScript, production build and Git whitespace checks
  passed.
- Additional browser checks exercised the actual comparison and report
  components at desktop and phone widths, keyboard restore, pending controls,
  interrupted restore with identical retry, readable editor labels, and
  comparison removal from print. These used clearly labeled fictional component
  fixtures.
- The signed-in local intake was checked at phone width with intercepted upload
  responses: a lost upload response and failed verification recovered on retry
  without a duplicate create or upload. An authenticated lookup of a nonexistent
  upload returned the expected 404 against the local service. No feedback, file,
  report, count or identity was created during this continuation.

This audit and implementation pass is complete locally. The ordered backlog
above remains future work, including durable drafts, report-version comparison,
reply deduplication and upload continuation after a browser restart. Protected
provider and populated workflow evidence remains limited as recorded in the
verification matrix. No deployment, push, merge or hosted-data change was made.

## Page-by-page UI goal - completed local pass, 2026-09-05

Owner requested a complete page review and implementation pass. All 32 page
routes were inventoried and reviewed in source; every reachable route was
checked in the real local browser at desktop and phone widths. Populated states
that could not be reached are listed explicitly below. Changes remain local.
Existing authentication, source approval, records controls, and saved payloads
remain intact. The user's approved Count Sheet direction is preserved.

| Page family         | Routes                                                                                                                            | Review result                                                                                                                                                                                                                                                                                                                                                                         |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Entry and account   | `/`, `/login`, `/account`                                                                                                         | Compact sign-in card, shadcn submit/recovery actions, aligned secret fields, and two-panel account layout. Desktop/mobile and keyboard reviewed. Forced temporary-passcode state has component coverage but no suitable current browser account.                                                                                                                                      |
| Home                | `/home`, `/preview/workspace`                                                                                                     | Shared command center, equal report/policy actions and responsive top navigation. Empty, populated fictional local incident, and training layouts reviewed.                                                                                                                                                                                                                           |
| Report Assistant    | `/incidents/new`, `/incidents/[incidentId]`, `/preview/report-assistant`                                                          | Six top steps, wider working area, compact headings, shadcn primary actions and aligned preview. All six steps reviewed; returning to notes preserves entries. One fictional incident saved locally. All four Document Studio sections reviewed, including desktop arrow-key tabs and native mobile selector.                                                                         |
| Policy Expert       | `/policy-expert`, `/preview/policy-expert`                                                                                        | Smaller heading and shared primary button; preview question selection uses shadcn. Signed-in question form and fictional answer/citation preview reviewed. Live sourced-answer state not exercised.                                                                                                                                                                                   |
| Reports and history | `/reports`, `/reports/[reportId]`, `/reports/drafts/[candidateId]`                                                                | Empty/populated incident list and missing-report/draft messages reviewed. Categories now display and search by the approved readable label; draft report type uses its existing label. Review-draft generation returned its safe unavailable message, so populated candidate, final-report and revision-history browser states remain unverified. Existing component coverage passes. |
| Count Sheet         | `/count-sheet`, `/preview/count-sheet`                                                                                            | Readable totals, tiny column markers, separate labels below the blue total row, and clear reconciliation. Signed-in loaded state and preview reviewed, with phone scrolling and fictional print behavior checked. No operational count save or print performed.                                                                                                                       |
| Forms               | `/forms`, `/preview/forms-library`                                                                                                | Signed-in and preview layouts reviewed. Shared shadcn open actions and accurate preview capability labels (local calculation, fictional print, not saved).                                                                                                                                                                                                                            |
| Improvements        | `/improvements`, `/improvements/new`, `/improvements/[requestId]`                                                                 | Centered shared page width, smaller brand headings and shadcn submit button. Empty list, intake and missing-detail states reviewed. No existing feedback record; populated conversation/reviewer view remains unverified in the browser. No feedback was sent.                                                                                                                        |
| Administration      | `/admin`, `/preview/admin`, `/admin/accounts`, `/admin/audit`, `/admin/health`, `/admin/improvements`                             | Shadcn destination navigation with explicit current-page styling and keyboard operation; current accounts precede creation form; audit outcomes use readable spacing. Preview reflects current destinations. All routes reviewed. Health renders its safe unavailable state; populated health signals unverified. No account changes performed.                                       |
| Retention           | `/admin/retention`, `/preview/admin-retention`                                                                                    | Empty protected registers and populated fictional preview reviewed at both widths. Shared admin navigation added. Confirmation controls and disabled preview remain intact; no hold, approval or deletion performed.                                                                                                                                                                  |
| Daily paperwork     | `/admin/paperwork/daily`, `/admin/paperwork/daily/[kind]`, `/admin/paperwork/daily/packages`, `/preview/admin-paperwork-packages` | Catalog, valid date/shift missing-source detail, invalid selection and disabled package preview reviewed. All six forms await approved source packages, so editors cannot be browser-verified. Live package registration intentionally returns 404 outside Production; its gate remains unchanged.                                                                                    |

### Visual and functional evidence

Local browser reviews used 1280px and 390px widths, reduced motion, keyboard
focus/navigation and settled rendered states. The Count Sheet checks also cover
320px zoom-equivalent reflow, horizontal table scrolling, independent flags,
calculation, and fictional print styling. No page overflow or unhandled page
errors were observed in the completed route scans. Loading placeholders were
rechecked after their content settled where screenshots caught a transition.

Screenshots and the small browser review helpers are outside the repository in
`../.ui-review/` and the parent workspace. The local review incident is clearly
labeled `FICTIONAL-UI-20260905`; its number, facts and saved revision were
verified through the authorized report list and Document Studio. The early
response-body inspection helper stalled after a successful save; the final
verification used the rendered authorized record. No exports, final reports,
source packages, account changes, feedback messages or records-control mutations
were created.

Validation completed:

- Full Vitest suite: 233 files passed, one skipped; 795 tests passed, one
  skipped.
- After the final category-label/navigation changes: 14 relevant tests passed,
  including four new checks for category search and current admin destinations.
- Operations suite: 69 tests passed.
- Preview browser suite: all 30 tests passed, covering automated WCAG A/AA,
  keyboard focus, responsive/reduced-motion views, navigation, Count Sheet
  calculation/print styling, and protected output guards.
- Formatting, full lint, typecheck, production build and git whitespace check
  passed. Final small TypeScript changes also passed targeted lint and build.

These results establish the local UI pass. They do not establish deployment or
verification of unavailable populated states. Those limitations are a follow-up
when the corresponding authorized local fixtures or services are available; no
access or source gate was bypassed to produce visual evidence.

## Handoff summary

Count Sheet housing columns (1–14, Iso, and Inf) each have an independent red
attention toggle beside its total in the bottom Housing total row. The header,
area entries, in-housing entry, and calculated totals highlight together. Click
again to clear. These local marks never modify counts or saved payloads and
reset when a saved sheet is loaded. As with existing row marks, print preserves
the selected tint while hiding the marker icon and retaining the column label
and total.

### Incremental component migration — 2026-09-05

The owner requested Tailwind and shadcn/ui adoption, starting with the workspace
dashboard for visual review. `WorkspaceCommandCenter` and `OfficerCommandCenter`
now share a presentational layout built from the official shadcn Button, Card,
Badge, and Separator components. Signed-in summaries remain server-authorized;
null, empty, and populated report lists remain distinct. Incident number and
incident name identify signed-in work. Preview rows remain explicitly fictional.

Tailwind v4 is configured through PostCSS. `globals.css` imports theme and
utilities separately, without global Preflight. Explicit `@source` entries scan
only the migrated dashboard and `src/components/ui`; add a source entry when
migrating another surface. Base resets are scoped to `.go-ui`. Wrap future
migrated surfaces in that class. Semantic colors map to the existing `--gow-*`
palette. Shared component source lives in `src/components/ui`, with `cn` in
`src/lib/utils`. The shadcn configuration uses the Radix-based new-york style
and Lucide icons. Default buttons are 44px high; large primary actions are 48px
high.

The refined design uses an open two-line heading and two equally prominent,
fully clickable report and policy panels. Each panel has one title, a
description, a tinted icon well, and a directional arrow, with no nested button.
Hover and keyboard focus emphasize the panel; reduced-motion preferences disable
movement. The action stack and work panel align in height on desktop and stack
on mobile. A quiet review strip, unboxed supporting links, and a light
administrator footer complete the page. The generated concept guides the page
body; the existing brand/header, truthful preview notice, Open forms shortcut,
complete training labels, tool order, and administrator explanation are
intentionally retained. The concept's replacement logo is not part of this
migration. Existing form and print styling remains in place.

Shared top navigation sits below the brand header on officer and preview pages:
Home, Report Assistant, Policy Expert, Reports & History, Count Sheet, and
Forms. These are real links with `aria-current="page"`, styled with a blue
underline, not in-page tabs. New incident entry highlights Report Assistant.
Account remains a separate trailing utility on signed-in pages; existing
role-gated administrator entries remain separate. At 860px and below a labeled
Menu button reveals the same destinations, with Escape dismissal and restored
toggle focus. Preview navigation uses fictional routes where available; Reports
& History stays protected.

Visual review covers heading hierarchy, equal action emphasis, cool palette,
outline icons, work-row readability, and responsive stacking. Verify desktop and
mobile in a browser, keyboard focus, reduced motion, navigation, and
accessibility before extending this system to another page. This local
implementation does not record owner approval of the final visual result or
authorize deployment.

Future contributors and assistant chats should preserve this direction:

> Guided Operations should feel calm, polished, formal, and high-end without
> feeling generic. Use a light cool blue-gray environment, strong editorial
> hierarchy, restrained depth, and practical command-center organization. The
> authenticated Home hero is a working command center, not a marketing banner.
> Report Assistant and Policy Expert are equal primary tools. Every operational
> value is real and authorized; fictional examples belong only in clearly
> labeled previews.

This brief defines experience and visual intent. It does not relax the product,
security, workflow, accessibility, or fictional-data requirements in
[`PRODUCT.md`](../../PRODUCT.md), [`principles.md`](principles.md), or
[`workflow-and-report-safety.md`](workflow-and-report-safety.md). Those
contracts take precedence when a visual idea conflicts with operational truth or
safety.

## Desired impression

The product should communicate:

- calm control rather than urgency;
- institutional credibility without looking like a generic government portal;
- premium craft without luxury decoration;
- practical confidence for an officer who needs to start work quickly;
- clear authorship, review, and source visibility; and
- visual sophistication that demonstrates strong website-design skill while
  remaining believable as an operational tool.

The product should not depend on a shield, badge, or agency-insignia treatment.
The current linked-path mark is an acceptable non-shield direction. A custom
floating mark may replace it after responsive, accessibility, reduced-motion,
and rights review. The mark supports the identity; it must not overpower the
work.

## Home is the command center

The authenticated Home page is the product's primary decision surface. Its first
viewport should answer three questions in order:

1. What do I need to do?
2. Where is my current work?
3. What other tools can I reach?

### Equal primary tools

Report Assistant and Policy Expert have equal visual and functional importance.
Neither may be reduced to a small utility link beneath the other.

- **Report Assistant:** starts or continues incident paperwork from known facts
  and keeps human review visible.
- **Policy Expert:** accepts an operational policy question and returns grounded
  guidance with approved source passages and bounded citations.

Each primary action needs a plain label, one-sentence functional promise,
recognizable icon, large click target, and honest unavailable state. Avoid
calling either tool “AI” in the primary label; describe the work it helps the
employee complete.

### Current work

The companion panel shows only server-authorized work belonging to the current
session. It may include an official incident number, descriptive incident name,
workflow state, and next action when those values are available from trusted
records.

- Never invent report rows, names, counts, notifications, health, timestamps, or
  synchronization claims.
- An empty state is a legitimate command-center state.
- Preview rows must say that they are fictional training examples.
- Administrative facility-wide metrics do not belong in the officer Home hero.

### Review path and supporting tools

The command center may reinforce the product's review model with a concise path
such as **Capture → Review → Confirm**. It is explanatory, not a fabricated
progress tracker.

Forms, Count Sheet, report history, and similar destinations sit below the two
primary tools as compact supporting actions. Administrator access is visible to
authorized administrators but remains a secondary, intentional entry rather than
competing with the officer's normal work.

## Page-family layout

One design system supports distinct working densities:

- **Officer Home:** calm, spacious, and action-first.
- **Report and Document Studio:** wider, visually quieter, document-oriented,
  and focused on facts, revisions, missing information, and deliberate output.
- **Policy Expert:** question and cited answer are the main two-part workspace;
  citations and source limitations remain visually inseparable from the answer.
- **Administrator areas:** denser command-center organization is appropriate,
  but every count and status needs a trustworthy query and honest loading,
  empty, error, and unavailable state.
- **Sign-in and account safety:** focused single-purpose pages with no
  decorative operational data and no credential values in URLs.

Page titles, route identity, and the primary action should remain visible
without requiring the user to interpret a decorative dashboard.

### Document Studio work hierarchy

Document Studio is an incident-level working surface, not a general dashboard.
Its top-level navigation has four task-oriented sections in this order:

1. **Reports** — the default section for supported draft, review, finalize, and
   report-history work.
2. **Notes & Facts** — reviewed fact states from the current authorized incident
   revision.
3. **Paperwork** — required items grouped by available digital work,
   physical-form requirement, and unavailable digital support.
4. **Incident Record** — current incident details, the active incident revision,
   and linked report revision heads.

Copy to Records remains a subordinate Reports subsection while it is
unavailable. It must not receive equal top-level prominence or fake print, Word,
or submission actions. Overview and report-history context belong together in
Incident Record rather than competing with active report and fact work.

The incident header may present one advisory **Next action** derived only from
server-authorized incident, reporting-officer, reviewed-fact, and report values.
That guidance is navigation, not persisted workflow state. It must never infer
packet completeness, filing, submission, synchronization, or system-of-record
status.

Desktop keeps an accessible four-item tab list. Mobile uses a labeled native
section selector rather than a horizontally scrolling tab rail. Both controls
must share one active-section state and preserve the same information priority.

## Visual language

### Color

Use the implemented cool blue-gray family as the baseline:

- pale blue-gray canvas and raised white/off-white work surfaces;
- deep navy for structure, primary actions, and high-confidence typography;
- muted slate blue for supporting copy and dividers;
- clear blue for links and keyboard focus; and
- restrained warm gold for small highlights, review state, or orientation.

Gold is an accent, not the atmosphere. Avoid large gold fields, saturated
royal-blue gradients, black dashboard themes, neon glow, or emergency-red
decoration. Error and warning colors remain available for real states and must
not be used as ornament.

### Typography

Use an editorial serif selectively for brand moments, major page titles, and
important card titles. Use the system sans-serif for forms, navigation, status,
instructions, tables, and long operational reading. The result should feel
formal and crafted while remaining fast to scan on ordinary facility hardware.

### Shape, depth, and imagery

- Prefer a few large composed surfaces over many interchangeable small cards.
- Use medium corner radii, fine blue-gray borders, and soft directional shadow.
- Tactile buttons may lift slightly on hover and settle on press.
- Keep icon drawing coherent, restrained, and legible without color.
- Decorative line work or soft background atmosphere may frame Home but must
  never obscure text or imply operational data.
- Do not use inmates, weapons, threatening weather, surveillance drama, or
  generic stock imagery to manufacture seriousness.

## Responsive behavior

Desktop and mobile express the same priority, not two different products.

### Desktop

- Use a bounded wide canvas with the command introduction and current work in a
  balanced two-column composition.
- Keep Report Assistant and Policy Expert side by side and equal.
- Place supporting tools in a compact band below the main command surface.

### Mobile

- Collapse the command surface into one readable column.
- Stack the two primary tools consecutively with equal weight; do not hide
  Policy Expert in a menu.
- Put current work after the primary choices.
- Convert supporting tools to full-width touch rows.
- Preserve at least 44 CSS-pixel touch targets and useful spacing at 320 CSS
  pixels, 200% text size, and 400% zoom.
- Avoid horizontal scrolling, clipped focus rings, or status labels that detach
  from the record they describe.

## Motion and interaction

Motion communicates response, not spectacle.

- Hover lift and arrow travel should be brief and subtle.
- Pressed state should feel tactile and immediate.
- Focus must be stronger and more reliable than hover.
- No looping glow, parallax, animated background drift, or delayed work state.
- `prefers-reduced-motion` removes decorative travel without removing state
  feedback.
- Loading must name what is loading; unavailable states must provide a practical
  next step.

## Voice and wording

Use plain, composed, operational language. Good copy explains what the employee
can do and what remains under their control.

- Prefer “Start a report,” “Ask Policy Expert,” “Your work,” and “Review before
  anything becomes official.”
- Avoid vague technology copy such as “Unlock AI-powered insights,” “smart
  workspace,” or “next-generation corrections platform.”
- Do not overuse “command center” in visible UI. It is the organizing concept,
  not a slogan.
- Policy wording must distinguish cited policy, paraphrase, operational advice,
  and insufficient evidence.
- Report wording must reinforce that the employee confirms facts and reviews
  every output.

## Acceptance checklist

A design change is aligned only when all applicable statements are true:

- Report Assistant and Policy Expert remain equal primary Home actions.
- The first viewport helps the employee choose a real task quickly.
- The interface feels cool blue-gray, formal, calm, and crafted.
- The composition is distinctive without relying on an oversized shield or
  decorative dashboard metrics.
- Every operational value is authorized and truthful.
- Empty, loading, unavailable, unsaved, failed, and conflict states are clear.
- Desktop and mobile preserve the same information priority.
- Keyboard, focus, touch, zoom, contrast, and reduced-motion behavior pass.
- Policy answers keep citations and limitations attached.
- Report work keeps review, missing information, and deliberate official actions
  visible.

The current command-center implementation is a candidate expression of this
brief, not permanent visual acceptance. Future refinement should be evaluated
against this brief in real desktop and mobile browsers before replacing the
authenticated experience.

Count Sheet reconciliation compares housing and operational totals side by side,
with a signed housing-minus-operational difference beneath them. Incomplete
sheets label it Current difference and retain the incomplete status. The panel
remains compact in print and stacks above operational inputs on mobile.
