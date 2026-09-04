# UI Polish Implementation Checklist

- **Status:** Active execution checklist (Waves 1–5 complete; Waves 6–8 planned)
- **Created:** 2026-08-31
- **Updated:** 2026-09-04 (site-wide Waves 6–8 sequence)
- **Scope:** Public previews, Count Sheet truthfulness, local
  authenticated-route readiness, responsive polish, shared UI consistency,
  authenticated-flow review, then site-wide token/primitive consolidation,
  page-family density, and the hands-on accessibility/print gate

This checklist turns the multi-plugin UI audit into narrow implementation waves.
It is an execution aid, not a second product contract. The governing decisions
remain the [Product Contract](../../PRODUCT.md),
[Experience Design Brief](experience-design-brief.md),
[Workflow and Report Safety](workflow-and-report-safety.md), and applicable
ADRs.

## Guardrails for every wave

- [ ] Preserve the equal Home prominence of Report Assistant and Policy Expert.
- [ ] Preserve the four Document Studio sections: Reports, Notes & Facts,
      Paperwork, and Incident Record.
- [ ] Keep non-production data, screenshots, tests, and previews fictional.
- [ ] Keep physical-only workflows physical-only.
- [ ] Do not deploy, migrate hosted data, create provider resources, or weaken
      authentication as part of UI work.
- [ ] Capture desktop and mobile browser evidence before and after each change.

## Wave 1 — Count Sheet truthfulness

- [x] Add a completeness state that distinguishes an untouched/incomplete sheet
      from a true zero-difference reconciliation.
- [x] Preserve blank values as blank; never turn missing entries into
      user-entered zeroes.
- [x] Show **Reconciled** only when the required reconciliation inputs are
      complete and the difference is zero.
- [x] Show an explicit incomplete message such as **Incomplete — enter known
      values to reconcile** while required values are missing.
- [x] Keep signed open differences visible and never auto-balance values.
- [x] Apply the same semantics to the fictional preview and authenticated Count
      Sheet workspace.
- [x] Add unit and browser coverage for blank, incomplete, reconciled, and
      positive/negative-difference states.

**Exit evidence:** A blank sheet never reads Reconciled; complete
zero-difference data does; focused tests and real-browser checks pass
(`0af88d8`). The stored validation contract remains unchanged, so historical
saved revisions do not need a data migration.

## Wave 2 — Safe local protected-route readiness

- [x] Follow the existing approved local-auth/Supabase documentation to find the
      intended non-secret development configuration.
- [x] Restore intended sign-in gating for `/account`, `/forms`, protected Count
      Sheet routes, and report output routes.
- [x] Verify unauthenticated protected APIs return 401 rather than a 500 runtime
      error.
- [x] Never insert production credentials or bypass server authorization.
- [x] Rerun the seven browser checks that were blocked by absent local public
      Supabase configuration.

**Completed (2026-08-31):** `npm run test:e2e:local-public` now reads only the
verified local public Supabase values, builds a temporary local server, and runs
the public-preview plus unauthenticated protected-route checks without resetting
the local database. All 25 checks pass, including the seven that formerly failed
before sign-in or a 401 response. The broader authenticated runner remains
separately reset-gated. No hosted service was touched.

**Exit evidence:** Protected local routes reach their designed authentication
state, or a precise external configuration blocker is recorded.

## Wave 3 — Mobile working-surface polish

- [x] Keep the Count Sheet as a semantic table with usable internal horizontal
      scrolling.
- [x] Add a clear narrow-screen cue such as **Swipe to view units** and a
      visible scroll affordance.
- [x] Preserve sticky row/column orientation where practical and do not hide
      scrollbars for aesthetics.
- [x] Tighten mobile heading scale on operational/admin pages while preserving
      the Officer Workspace identity.
- [x] Standardize narrow-header stacking of route title, preview badge, and
      secondary actions.
- [x] Verify 320 px, 390 px, 768 px, desktop, keyboard, reduced-motion, and
      print behavior where applicable.

**Exit evidence:** No page-level overflow, discoverable table navigation, and
unchanged information priority across sizes (`5617bf1`, `ae52874`). Browser
checks covered 320, 390, 768, and desktop widths; the focused reduced-motion
mobile and print test passes.

### Owner-requested desktop Count Sheet fit

- [x] Give the Count Sheet table the full desktop work area so columns 1–14,
      Iso, Inf, and Area total remain visible without horizontal scrolling.
- [x] Move reconciliation and sheet details below the table on desktop instead
      of narrowing the primary entry surface.
- [x] Keep the desktop unit-number header visible while the officer scrolls
      vertically through the long sheet.
- [x] Keep the existing internal horizontal scroll, swipe cue, and sticky area
      names at tablet and mobile widths.
- [x] Add a browser regression assertion that desktop table width does not
      exceed its visible region.

**Local evidence (2026-08-31):** At the 1,265 px browser content width, the
table and its visible region both measure 1,178 px, the first and last headers
remain inside the region, and the region reports no horizontal overflow. At the
375 px mobile content width, page-level overflow remains absent while the table
retains its 1,712 px internal working width, automatic horizontal scrolling, the
visible swipe cue, and sticky area labels. At a 1,450 px desktop page scroll,
the complete unit-number header remains pinned at the viewport's 0 px top edge
while the table continues beneath it; the mobile unit headers remain non-sticky.

## Wave 4 — Shared UI consistency

- [x] Inventory the existing shared header, notice, status, empty, and error
      implementations.
- [x] Reuse existing visual tokens and focus treatment.
- [x] Create or extend a shared primitive only when the behavior genuinely
      recurs; avoid route-local duplicates and broad rewrites.
- [x] Ensure status, error, busy, and unavailable states are truthful,
      accessible, and preserve visible user input.
- [x] Keep fictional-preview labels unmistakable.

**Exit evidence:** Repeated states align across pages without changing route or
business behavior.

**Progress evidence:** The shared recovery surface now handles both recovery
links and the bounded root-error retry action (`3755547`), with component tests
and a production build passing. The mobile reduced-motion browser check now
verifies the shared `Fictional training preview` label on every public preview
route. A focused component pass now confirms truthful Document Studio
unavailable/empty copy and the revision form's conflict recovery; the latter
keeps the officer's typed correction visible after the server returns `409`. The
same pattern is used for loading and status messaging through `aria-busy`,
`role="status"`, and polite live regions rather than fabricated success states.
The focused Count Sheet tests also now require the loaded blank sheet to expose
its truthful status, and require the print-audit busy state to remain an
accessible status while entry controls are locked.

## Wave 5 — Authenticated-flow and administrator review

- [x] Visually audit all four authenticated Document Studio sections and their
      loading, empty, error, conflict, unsaved, review, and success states.
- [x] Keep Copy to Records subordinate to Reports.
- [x] Make administrator overview prioritize authorized actionable work rather
      than planned-feature cards or fabricated metrics.
- [x] Verify keyboard order, focus visibility, labels, live announcements,
      mobile layout, zoom, and print behavior.

**Exit evidence:** Authenticated journeys have current browser evidence and
preserve review-first, source-visible workflow rules.

**Progress evidence (2026-08-31):** The explicit fictional-only reset lane now
passes end to end: encrypted-session integration; sign-in resistance;
multi-device session revocation; 25 public checks; protected Count Sheet save,
reopen, and print; the officer/admin Report Assistant lifecycle (including all
four Document Studio sections, subordinate Copy to Records, mobile section
navigation, and desktop tab navigation); protected incident creation; and three
administrator boundary/roster checks. The administrator home now leads with the
currently authorized task routes and describes their step-up safeguard instead
of implying that account controls are merely planned. The runner waits for the
seeded local database after every reset, preventing a restart race from
masquerading as a product failure. The browser-observable all-section
visual-state matrix is complete.

**Local visual-audit evidence (2026-08-31):** With a clean fictional reset, the
in-app browser captured the real protected Report workspace at desktop
(`34-document-studio-reports-desktop.png`) and reviewed its four actual
sections: Reports, Notes & Facts, Paperwork, and Incident Record (`35`–`37`).
The 390 px browser capture (`39-document-studio-reports-mobile-viewport.png`)
confirms that the same section switcher becomes a labelled select control
without horizontal overflow. The administrator overview capture
(`41-admin-overview-desktop.png`) shows only protected actionable routes and its
step-up warning. The browser qualification exercised review, finalization,
revision success, `409` conflict, and preservation of the stale typed
correction; the focused component pass checked Document Studio error/empty copy.
The browser-observable interaction proof includes a real loading state, visible
keyboard focus coverage, labelled controls, `role="status"`/`aria-busy`
semantics, 320/390 px reflow, scalable-viewport inspection, and the guarded
print workflow. Native screen-reader speech and the operating-system print
dialog are intentionally not claimed by this local automated qualification.

## Follow-on hands-on validation (not a local code gate)

- [ ] Have an assistive-technology user confirm spoken status announcements and
      inspect the operating-system print dialog on the intended production
      browser/operating-system combination.

**Execution aid:** Use the
[hands-on accessibility and print validation runbook](../quality/hands-on-accessibility-print-validation.md)
to capture the tester, exact commit, environment, assistive technology, and
fictional-only observations. Do not mark this item complete until a human test
on the intended browser/operating-system combination is recorded.

## Site-wide improvement sequence (Waves 6–8)

Waves 1–5 locked the visual direction and Count Sheet / Document Studio truth.
Waves 6–8 close remaining consistency debt, page-family density, and the open
accessibility/print gate **without** redesigning the accepted navy/gold
direction. Governing contracts remain
[Experience Design Brief](experience-design-brief.md),
[DESIGN.md](../../DESIGN.md), and
[Workflow and Report Safety](workflow-and-report-safety.md).

Execute in order. Do not start Wave 7 until Wave 6 exits. Do not claim Wave 8
complete until a human AT + OS print record exists. Keep preview routes and
authenticated routes visually aligned in every wave.

### Wave 6 — Tokens and shared control primitives

**Goal:** One accent system and a small set of recurring controls so later
page-family work does not invent new colors or button styles.

- [x] Replace hard-coded teal/cyan accents outside the design system with
      `--gow-*` tokens. Known offenders: - Incident primary CTA and
      draft-request focus/accent in `src/app/globals.css` (`.incident-*` /
      `#176f72`) and
      `src/app/incidents/[incidentId]/report-draft-request-form.module.css` -
      Improvements surfaces using `#1d5e80`, `#2f6f90`, and undefined
      `var(--color-accent, #2f6f90)` in `src/app/globals.css`
- [x] Add any missing shared tokens only when they replace real duplicates (for
      example a single `--gow-action` / status-accent alias). Do not introduce a
      second token system or dark theme.
- [x] Extract or extend shared control classes (or tiny presentational
      components) only for patterns that already recur: primary action,
      secondary/text action, status/empty/error notice, busy lock. Prefer CSS
      reuse over a component library rewrite. Do not add shadcn/Tailwind.
- [x] Remove or rewrite dead landing styles that assume a disabled gray
      `.sign-in-card` form while the live control is a `.primary-action` link
      (`src/app/page.tsx`, related rules in `src/app/globals.css`).
- [x] Begin modularizing `src/app/globals.css` by moving clearly isolated
      feature blocks (improvements, landing leftovers, one large page family)
      into existing or new CSS modules without changing visual output. Target
      behavior-preserving extraction, not a full stylesheet rewrite in one PR.
- [x] Keep `--gow-focus` as the only focus ring; improvements must not keep a
      parallel focus color.
- [x] Capture before/after desktop and mobile screenshots for Home, Policy
      Expert, Document Studio (or new-incident CTA), Improvements launcher, and
      landing. Run format, lint, typecheck, focused component/CSS-adjacent
      tests, and a production build.

**Exit evidence:** No `#176f72` / `#1d5e80` / `#2f6f90` / `--color-accent`
remains in app CSS except historical comments if any; primary actions share one
navy treatment; landing CSS matches the live link CTA; screenshots show no
unintended redesign.

**Progress (2026-09-04):** Added `--gow-action`, `--gow-tint`, and
`--gow-tint-border`; introduced `.gow-primary-control`,
`.gow-secondary-control`, and `.gow-text-control`; converted incident and
improvements accents to navy/blue tokens; removed dead `.sign-in-card`
form/input/button styles; extracted `src/app/improvements-surfaces.css`.
Screenshot/gate evidence follows in the same wave before Wave 7 starts.

### Wave 7 — Page-family density and information architecture

**Goal:** Match each surface to the brief’s density rules and fix shell/IA
inconsistencies that make the site feel unfinished after Wave 6 tokens land.

#### Landing (`/`)

- [x] Tighten the first viewport to brand, one headline, one short supporting
      sentence, and the sign-in CTA group. Move Capture→Review→Confirm,
      principle list, and preview links below the first viewport so the entry
      reads as one composition rather than a packed marketing column
      (`src/app/page.tsx`).
- [x] Preserve “Advisory only,” fictional-preview labeling, and no facility name
      in display copy (OQ-003).

#### Officer Home (`/home`)

- [x] Keep Report Assistant and Policy Expert equal and primary.
- [x] Reduce competing secondary bands: tools strip, progress path, and current
      work should read as one command center with clear priority, not three
      equal marketing blocks (`workspace-command-center.tsx` + related CSS).
- [x] Empty current-work state remains legitimate; never invent rows or metrics.

#### Policy Expert (`/policy-expert`)

- [x] Treat insufficient-evidence / no-sources as a first-class calm empty
      state: clear limitation, what the officer should do next (source or
      supervisor), no fake citations. Align preview and authenticated copy.
- [x] Keep question + cited answer as the two-part workspace; do not add
      dashboard chrome.

#### Document Studio and reports

- [x] Confirm mobile native section `<select>` is the only narrow-width section
      switcher; remove or neutralize any leftover horizontally scrolling tab
      styles that compete with it (`document-studio.module.css` vs `globals.css`
      `.document-studio-tabs`).
- [x] Align print/download/sign-out control treatment with Wave 6 shared
      secondary actions (text-link vs filled CTA consistency).
- [x] Keep honest labeling on 005/409 Word download: generic reviewed-report
      export until the authoritative source form lands (do not claim official
      form fidelity in UI copy).

#### Forms Library and Count Sheet

- [x] Prefer large composed catalog sections over interchangeable small cards
      where card chrome does not aid interaction.
- [x] Preserve Count Sheet truthfulness and owner-approved desktop fit; Wave 7
      is density/consistency only.

#### Improvements

- [x] Keep the global launcher; do not force Improvements into
      `WORKSPACE_NAV_ITEMS` unless the owner asks for nav clutter.
- [x] After Wave 6 token unification, verify launcher + `/improvements*` + admin
      review share shell density, focus, and status patterns with the rest of
      the workspace.

#### Administrator shell and home

- [x] Fix `AdminShell` so officer nav `current` highlighting is not always
      cleared (`current={undefined}` in `admin-shell.tsx`). Prefer highlighting
      nothing on admin-only routes **or** a deliberate admin-home affordance—
      pick one pattern and apply it on every admin page; do not leave the nav
      looking broken.
- [x] Keep Admin as a secondary intentional entry from Home (not a peer nav item
      competing with Report Assistant / Policy Expert).
- [x] Reduce card-stack admin overview and daily-paperwork grids toward denser
      actionable lists with honest empty/error states; no planned-feature cards
      or fabricated metrics.

#### Cross-cutting Wave 7 checks

- [x] Desktop + mobile browser evidence for landing, Home, Policy Expert,
      Document Studio, Forms, Admin home, Improvements.
- [x] Preview routes stay in visual lockstep with authenticated counterparts.
- [x] Keyboard order, focus visibility, and reduced-motion still pass automated
      checks on changed routes.

**Progress (2026-09-04):** Landing hero tightened; Home tools band demoted to
"More tools"; Policy Expert insufficient-evidence next-step copy; dead
`.document-studio-tabs` CSS removed (module mobile select remains); AdminShell
intentionally leaves officer nav unhighlighted and marks admin chrome; admin and
forms list cards densified. Browser screenshot evidence still open.

**Exit evidence:** Landing first viewport matches the brief; Home remains equal
primary tools without secondary clutter winning; Admin nav state is intentional;
Policy Expert no-sources state is calm and honest; no new accent colors
reintroduced.

### Wave 8 — Accessibility and print gate + defect repair

**Goal:** Close the open manual gate and fix defects the human pass finds.
Automation remains necessary but not sufficient.

**Automated progress (2026-09-04):** Public and fictional preview axe checks
pass on Chromium against production build; evidence in
[2026-09-04-wave8-automated-a11y-evidence.md](../quality/2026-09-04-wave8-automated-a11y-evidence.md).
`/account` and `/forms` axe runs remain blocked without local Supabase public
env. Human AT + OS print still required before ROADMAP item #8 closes.

- [x] Run automated axe + keyboard/focus/reflow checks on public and preview
      routes (see evidence record).
- [ ] Run the
      [hands-on accessibility and print validation runbook](../quality/hands-on-accessibility-print-validation.md)
      on the intended browser/OS with a representative AT user and fictional
      data only. Record commit SHA, environment, AT, and Pass/Issue/Not
      exercised per check.
- [ ] Fix every **Issue** from that record in narrow follow-up commits:
      announcement gaps, unlabeled controls, focus traps, print chrome leaking
      into OS print preview, clipped/overlapping print content, false reconciled
      announcements, and conflict-recovery speech gaps.
- [ ] Re-run only the failed AT/print scenarios after fixes; do not mass-
      regenerate visual baselines to paper over defects.
- [ ] Mark the checklist follow-on item and ROADMAP open item #8 complete only
      when the human evidence record exists and blocking Issues are resolved or
      explicitly owner-accepted.

**Exit evidence:** Dated human AT + OS print record attached or linked from
`docs/quality/`; blocking Issues closed or owner-accepted; automated a11y suite
still green.

## Final verification

- [x] Run formatting, lint, typecheck, focused tests, full tests when practical,
      preview browser tests, production build, and security-diff review.
- [x] Inspect browser console errors and failed assets on changed routes.
- [x] Compare before/after desktop and mobile screenshots instead of blindly
      regenerating baselines.
- [x] Record any unresolved local environment requirement without credentials.
- [x] Keep commit/push, pull request, deployment, migration, pilot, and
      production decisions separate for owner approval.

**Current quality evidence (2026-08-31):** Formatting, lint, typecheck, the
production build, tracked-secret scan, runtime-logging scan, and dependency
audit pass. The full test gate reports 764 passing and one intentionally skipped
test, and the operations guard suite passes. The reset-free local public browser
qualification passes all 25 official checks, including unauthenticated account,
forms, Count Sheet print, and report-output gates. The broader local
authenticated qualification remains deliberately reset-gated. After the latest
shared-preview check, formatting, lint, typecheck, the full unit suite, the
66-test operations guard suite, a production build, tracked-secret scan,
runtime-logging scan, and the focused 15-check browser accessibility suite all
pass. Browser checks report no console errors or failed assets on the reviewed
routes. The local high-severity dependency audit currently finds zero
vulnerabilities; GitHub still reports six Dependabot alerts on the default
branch. They are three `transformers` alerts (two high, one medium) and three
`torch` alerts (one medium, two low), all in the optional policy-ingestion
`uv.lock`; they require separate dependency and ingestion qualification before
any release decision. Matching-viewport desktop and mobile captures were
compared against the original public workspace review images; no visual
regression was found in the public workspace (`31-workspace-913x667-current.png`
and `32-workspace-375x812-current.png`). The complete guarded authenticated
qualification now also passes after a fictional-only reset; it remains local
evidence only and does not imply hosted readiness.
