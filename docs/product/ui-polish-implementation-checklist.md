# UI Polish Implementation Checklist

- **Status:** Active execution checklist
- **Created:** 2026-08-31
- **Scope:** Public previews, Count Sheet truthfulness, local authenticated-route readiness, responsive polish, shared UI consistency, and later authenticated-flow review

This checklist turns the multi-plugin UI audit into narrow implementation waves.
It is an execution aid, not a second product contract. The governing decisions
remain the [Product Contract](../../PRODUCT.md), [Experience Design
Brief](experience-design-brief.md), [Workflow and Report
Safety](workflow-and-report-safety.md), and applicable ADRs.

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

- [ ] Add a completeness state that distinguishes an untouched/incomplete sheet
      from a true zero-difference reconciliation.
- [ ] Preserve blank values as blank; never turn missing entries into
      user-entered zeroes.
- [ ] Show **Reconciled** only when the required reconciliation inputs are
      complete and the difference is zero.
- [ ] Show an explicit incomplete message such as **Incomplete — enter known
      values to reconcile** while required values are missing.
- [ ] Keep signed open differences visible and never auto-balance values.
- [ ] Apply the same semantics to the fictional preview and authenticated Count
      Sheet workspace.
- [ ] Add unit and browser coverage for blank, incomplete, reconciled, and
      positive/negative-difference states.

**Exit evidence:** A blank sheet never reads Reconciled; complete zero-difference
data does; focused tests and real-browser checks pass.

## Wave 2 — Safe local protected-route readiness

- [ ] Follow the existing approved local-auth/Supabase documentation to find
      the intended non-secret development configuration.
- [ ] Restore intended sign-in gating for `/account`, `/forms`, protected Count
      Sheet routes, and report output routes.
- [ ] Verify unauthenticated protected APIs return 401 rather than a 500 runtime
      error.
- [ ] Never insert production credentials or bypass server authorization.
- [ ] Rerun the seven browser checks that were blocked by absent local public
      Supabase configuration.

**Exit evidence:** Protected local routes reach their designed authentication
state, or a precise external configuration blocker is recorded.

## Wave 3 — Mobile working-surface polish

- [ ] Keep the Count Sheet as a semantic table with usable internal horizontal
      scrolling.
- [ ] Add a clear narrow-screen cue such as **Swipe to view units** and a
      visible scroll affordance.
- [ ] Preserve sticky row/column orientation where practical and do not hide
      scrollbars for aesthetics.
- [ ] Tighten mobile heading scale on operational/admin pages while preserving
      the Officer Workspace identity.
- [ ] Standardize narrow-header stacking of route title, preview badge, and
      secondary actions.
- [ ] Verify 320 px, 390 px, 768 px, desktop, keyboard, reduced-motion, and
      print behavior where applicable.

**Exit evidence:** No page-level overflow, discoverable table navigation, and
unchanged information priority across sizes.

## Wave 4 — Shared UI consistency

- [ ] Inventory the existing shared header, notice, status, empty, and error
      implementations.
- [ ] Reuse existing visual tokens and focus treatment.
- [ ] Create or extend a shared primitive only when the behavior genuinely
      recurs; avoid route-local duplicates and broad rewrites.
- [ ] Ensure status, error, busy, and unavailable states are truthful,
      accessible, and preserve visible user input.
- [ ] Keep fictional-preview labels unmistakable.

**Exit evidence:** Repeated states align across pages without changing route or
business behavior.

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

- [ ] Run formatting, lint, typecheck, focused tests, full tests when practical,
      preview browser tests, production build, and security-diff review.
- [ ] Inspect browser console errors and failed assets on changed routes.
- [ ] Compare before/after desktop and mobile screenshots instead of blindly
      regenerating baselines.
- [ ] Record any unresolved local environment requirement without credentials.
- [ ] Keep commit/push, pull request, deployment, migration, pilot, and
      production decisions separate for owner approval.
