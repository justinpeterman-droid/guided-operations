# Guided Operations Completion Execution Design

- **Status:** Proposed for owner review
- **Date:** 2026-08-28
- **Repository:** `justinpeterman-droid/guided-operations`
- **Persistent tracker:** GitHub Issue #2 — `GOAL: Finish Guided Operations hobby release`

## Purpose

This document defines how implementation work will be organized and tracked until Guided Operations reaches the completion boundary already defined by `PRODUCT.md` and `ROADMAP.md`.

It does **not** replace the product contract, architecture, security policy, ADRs, or roadmap. `ROADMAP.md` remains the authoritative delivery sequence. Issue #2 is the persistent progress tracker across chat sessions.

## Approved finish goal

Finish Guided Operations as a usable private hobby release at `https://guided-operations.vercel.app` with:

- individual officer and administrator authentication;
- the officer incident/report workflow and Document Studio;
- Forms, Count Sheet, and operational paperwork;
- grounded Policy Expert using only an approved reconciled policy/reference corpus;
- administrator account, oversight, audit, and health controls;
- responsive, keyboard-accessible, reduced-motion, print-ready user interfaces;
- tested persistence, authorization, revision history, backup/restore, monitoring, release, and rollback behavior.

Real operational/personnel data remains outside this release boundary. Only approved policy/reference material may be real, and only after the corpus migration gate passes.

## Tracking model

The selected model is **one master issue plus the existing roadmap**.

- GitHub Issue #2 stores the durable goal, active milestone, and high-level completion checklist.
- `ROADMAP.md` remains the source of truth for phases, gates, and evidence requirements.
- Individual phase or feature issues are created only when the work is ready to start and a separate acceptance gate is useful.
- Each substantial pull request links to the master goal and the applicable roadmap gate.
- After substantial merged work, Issue #2 is updated with the completed milestone evidence and the next highest-value blocker.

This avoids both extremes: a roadmap with no durable session tracker, and a large issue backlog that becomes stale before implementation reaches it.

## Decision policy

When a choice is not already fixed by the repository contracts, implementation should default to the safest practical recommendation that preserves the product goal and minimizes unnecessary architecture.

No owner interruption is required for ordinary reversible engineering choices such as file organization, test decomposition, UI component boundaries, naming, or choosing between equivalent implementation patterns.

Explicit owner approval is still required when the repository contract already defines an owner gate, including:

- merging a pull request;
- deploying or changing production traffic;
- applying hosted database migrations or destructive data operations;
- provisioning or changing real identities;
- changing the current fictional-data boundary;
- importing or publishing controlled policy corpus content outside the approved migration process;
- adding a paid service or materially changing recurring cost;
- weakening an accepted security, authorization, audit, revision, citation, backup, or review-before-output rule;
- choosing an irreversible migration/cutover action.

When a recommended approach fails a security or correctness gate, the implementation must fall back to the next documented safe option rather than weakening the acceptance criteria.

## Current baseline reconciliation

The first task is documentation truth, because several current-state paragraphs in `ROADMAP.md`, `ARCHITECTURE.md`, and `SECURITY.md` predate later verified commits.

The reconciled baseline must record at least these facts:

1. `https://guided-operations.vercel.app` is the canonical verified Vercel foundation deployment.
2. The live foundation page and `/api/health/live` were remotely verified.
3. The private GitHub repository is connected to the authoritative Vercel project.
4. Owner decisions O-012 through O-014 resolved the minimum passcode, initial administrator authority, and hobby-boundary MFA decision.
5. ADR-0003 remains **Proposed** because its hosted alias-bridge spike, lifecycle proof, threat model, session tests, and formal security acceptance are still incomplete.
6. Sign-in remains disabled until the authentication gate is accepted.
7. The real policy/reference corpus remains outside the hosted application until its inventory, rights, hashing, page mapping, version reconciliation, and citation gates pass.

The reconciliation must remove stale blockers without converting unverified target controls into claims of completion.

## Active milestone 1 — Foundation truth to secure login

### Goal

Turn the verified no-data foundation into a protected authenticated vertical slice with one fictional administrator, one fictional officer, and a working authenticated dashboard.

### Sequence

1. Reconcile stale current-state documentation and roadmap blockers.
2. Complete ADR-0003's remaining Supabase Auth alias-bridge spike and threat model using the existing preferred Option A.
3. If Option A cannot satisfy the alias/recovery/non-enumeration requirements, stop and record the documented Option B custom opaque-session design rather than weakening the credential or privacy requirements.
4. Implement the accepted authentication/session design with server-only account resolution, secure HttpOnly cookies, rotation/revocation, forced temporary-passcode change, generic failures, throttling, lockout, logout-all, and current account-status checks.
5. Implement least-privilege grants plus default-deny operation-specific RLS/Storage policies and direct negative tests.
6. Implement the protected first-admin bootstrap and account lifecycle required for a fictional officer account.
7. Enable the authenticated dashboard only after the negative security and browser-session gates pass.

### Acceptance evidence

Milestone 1 is complete only when:

- ADR-0003 is Accepted or a replacement ADR is accepted;
- public signup and unapproved recovery remain unavailable;
- internal aliases cannot be observed in UI, API responses, logs, browser storage, emails, redirects, or public recovery paths;
- known and unknown employee numbers return generic bounded responses;
- login, refresh, rotation, expiry, forced change, logout, logout-all, reset, deactivation, lockout, role change, and admin step-up tests pass;
- grants and RLS negative tests deny missing, disabled, cross-user, and cross-role access;
- a fictional administrator and fictional officer can sign in to a protected environment;
- the authenticated dashboard loads with no console errors and no restricted data leakage;
- Issue #2 and `ROADMAP.md` are updated with the evidence.

## Later milestones

After Milestone 1, implementation follows the existing roadmap rather than creating a second delivery sequence:

- incident and report vertical slice;
- forms and operational paperwork;
- policy corpus reconciliation and grounded assistance;
- administration and operational controls;
- live-environment qualification;
- owner-authorized promotion and observation.

Each milestone should produce working, testable software before the next broad subsystem begins. Corpus inventory/reconciliation may proceed in parallel where it does not bypass its migration gate.

## Change and review discipline

- Work on a narrow branch for each coherent acceptance gate.
- Prefer pull requests over direct changes to `main`.
- Do not merge, deploy, migrate hosted data, provision identities, retire infrastructure, or change traffic without explicit owner authorization.
- Keep implementation changes narrow enough that a reviewer can reject one without invalidating unrelated work.
- Update behavior contracts and tests in the same pull request when behavior changes.
- Preserve unrelated user work.

## Test discipline

Every implementation task begins with the smallest relevant failing test when practical, then proves the implementation with the narrow gate before broad validation.

For web changes, the expected full local gate is:

```powershell
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
```

Database changes additionally require migration reset/replay, database lint, pgTAP, grants/RLS negative tests, and review of generated diffs.

UI changes additionally require real-browser checks at desktop and mobile sizes, keyboard navigation, focus behavior, reduced-motion behavior, console/asset inspection, and print checks when relevant.

Security-sensitive changes require positive and negative tests; hidden UI does not count as authorization evidence.

## Data and hosting boundaries

- Application runtime: Next.js 16 / React 19 on Vercel.
- Database/Auth/Storage/vector/queue foundation: Supabase.
- AI: provider-neutral server interfaces; OpenAI is the initial permitted adapter.
- Google Cloud hosting/runtime dependencies are not part of the target.
- Operational/personnel data remains fictional for this release.
- Controlled policy/reference content is never committed to Git and is imported only through the approved corpus process.
- Browser code never receives server/service credentials or direct unrestricted application-table access.

## Completion condition

The master goal closes only when `PRODUCT.md`'s **Definition of replacement complete** is satisfied or an explicit owner-approved omission is recorded in the authoritative product/roadmap documents.

A successful build, a Vercel deployment, an accepted feature, or a passing test suite is evidence for its specific gate only; none of those alone means the product is finished.

## Non-goals

This completion effort does not authorize:

- official agency/facility adoption;
- real incident, inmate, report, roster, personnel, or operational-paperwork data;
- a shared access code or weak common PIN;
- multi-facility tenancy;
- speculative worker infrastructure before measured need;
- Google Cloud runtime dependencies;
- bypassing security, corpus, backup, release, or owner-approval gates for speed.
