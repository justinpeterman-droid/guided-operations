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
- [ ] Ensure status, error, busy, and unavailable states are truthful,
      accessible, and preserve visible user input.
- [x] Keep fictional-preview labels unmistakable.

**Exit evidence:** Repeated states align across pages without changing route or
business behavior.

**Progress evidence:** The shared recovery surface now handles both recovery
links and the bounded root-error retry action (`3755547`), with component tests
and a production build passing. The mobile reduced-motion browser check now
verifies the shared `Fictional training preview` label on every public preview
route. Authenticated state coverage remains in Wave 5.

## Wave 5 — Authenticated-flow and administrator review

- [ ] Visually audit all four authenticated Document Studio sections and their
      loading, empty, error, conflict, unsaved, review, and success states.
- [ ] Keep Copy to Records subordinate to Reports.
- [ ] Make administrator overview prioritize authorized actionable work rather
      than planned-feature cards or fabricated metrics.
- [ ] Verify keyboard order, focus visibility, labels, live announcements,
      mobile layout, zoom, and print behavior.

**Exit evidence:** Authenticated journeys have current browser evidence and
preserve review-first, source-visible workflow rules.

## Final verification

- [x] Run formatting, lint, typecheck, focused tests, full tests when practical,
      preview browser tests, production build, and security-diff review.
- [x] Inspect browser console errors and failed assets on changed routes.
- [ ] Compare before/after desktop and mobile screenshots instead of blindly
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
routes.
