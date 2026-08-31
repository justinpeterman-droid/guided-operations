# UI Polish Implementation Checklist

- **Status:** Active execution checklist
- **Created:** 2026-08-31
- **Scope:** Public previews, Count Sheet truthfulness, local
  authenticated-route readiness, responsive polish, shared UI consistency, and
  later authenticated-flow review

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
