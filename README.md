# Guided Operations

Guided Operations is the private, web-only replacement for `prison-policy-ai`.
It is designed for one correctional facility and brings incident reports,
operational paperwork, forms, and cited policy guidance into one review-first
workspace.

This repository contains no live operational records and no policy corpus
content. The real policy/reference corpus passed its inventory, rights, hashing,
and reconciliation protocol and was imported into production private Storage on
2026-08-30; it stays out of Git, local development, CI, Preview, screenshots,
logs, and test fixtures.

## Current state

As of 2026-09-01 the application is released to production and in a post-release
hardening period. The release evidence is recorded in
[Production release](docs/operations/2026-08-30-production-release.md) and
[Production corpus registration and import](docs/operations/2026-08-30-production-corpus-import.md).

Released is not the same as finished. The most important open item is that the
production policy corpus is imported but not yet approved or embedded, so Policy
Expert honestly reports that it has no sources instead of citing policy. See
[Known gaps](#known-gaps) below.

| Area              | State                                                                                                                                                                                                                                                                                                                  |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GitHub repository | Private. On 2026-09-01, Web quality, Authenticated browser quality, and Recovery rehearsal passed on exact `main` commit `49812ec4`; Database quality exposed one test-role assertion defect now corrected on a follow-up branch. See [post-merge qualification](docs/quality/2026-09-01-post-merge-qualification.md). |
| Web application   | Next.js 16 App Router and React 19. Protected officer, account, incident and report, Policy Expert, Forms Library, Count Sheet, and administrator routes are implemented and released.                                                                                                                                 |
| Appearance        | Guided Operations navy/gold design tokens. The five UI polish waves and the owner-reviewed desktop Count Sheet fit are complete through `dbbc8d6`.                                                                                                                                                                     |
| Authentication    | Employee number plus personal passcode is released: guarded sign-in, encrypted session cookies, refresh rotation, forced temporary-passcode change, personal passcode change, logout and logout-all, first-admin bootstrap, account lifecycle, and purpose-bound administrator step-up.                                |
| Database          | Supabase project in `us-east-1`. Fourteen pending migrations were applied on 2026-08-30 after schema and data dumps were taken outside the repository; local and remote migration histories matched exactly at that point.                                                                                             |
| RAG corpus        | 236 approved documents registered and 235 imported into production private Storage on 2026-08-30 across 1,310 pages and 1,224 chunks. Every document remains `awaiting_review` with `qa_approved = false`, so nothing is embedded and nothing is searchable yet. One document failed to import.                        |
| AI providers      | `gpt-5.6-terra` is pinned for policy answers and report drafting and `text-embedding-3-small` for embeddings, both verified current on 2026-08-30. See O-027.                                                                                                                                                          |
| Vercel            | Git-connected. The released deployment returned `ok` from `/api/health/live` and `ready` from `/api/health/ready` on 2026-08-30.                                                                                                                                                                                       |
| Operations        | Encrypted off-provider backup tooling, complete readiness validation, secret and dependency scanning, redacted telemetry, and a local fictional database-plus-Storage recovery rehearsal exist. Hosted backup scheduling, a live restore drill, monitoring sinks, alerting, and budgets do not.                        |

### Known gaps

These are the open items as of 2026-09-01. Most need an owner decision or an
operator action rather than new application code. The fuller list, with the
reasoning, is [Current open items](ROADMAP.md#current-open-items).

1. **The corpus is not searchable.** All 235 imported documents are
   `awaiting_review` and their chunks are `pending` with `qa_approved = false`.
   The owner must approve them and run an embedding batch before Policy Expert
   can cite anything.
2. **One policy is permanently absent until the annual refresh.**
   `SD 2022-01 Revised COVID Visitation Directive.pdf` failed import on NUL
   bytes in its page 5 checkbox glyphs. The owner deferred the normalization fix
   to the annual refresh in O-026.
3. **The database CI rerun still needs to turn green.** Web quality,
   Authenticated browser quality, and Recovery rehearsal passed on exact `main`
   commit `49812ec4` on 2026-09-01. Database quality rebuilt and linted the
   database, then exposed a pgTAP role-restoration defect in one assertion. The
   test-only correction is on the follow-up branch; pass it there and rerun it
   on the resulting exact `main` commit. See
   [post-merge qualification](docs/quality/2026-09-01-post-merge-qualification.md).
4. **Hosted recovery is unproven.** The backup tool has never been run against
   hosted production, and no decryption or isolated restore has been performed.
5. **Production monitoring does not exist.** There are no monitoring sinks,
   alert delivery, cost caps, provider budgets, or a rehearsed rollback.
6. **Administrator assurance is unresolved for real data.** O-013 remains an
   open release gate; O-020 defers second-factor administration only for the
   fictional-data phase, while O-015 authorizes real data in production.
7. **The official 005/409 output is not authoritative.** The deterministic
   mapping and fidelity checks exist, but the authoritative source form has not
   been obtained, so the Word download is a generic reviewed-report export.
8. **Manual accessibility and print validation is not done.** The runbook in
   [Hands-on accessibility and print validation](docs/quality/hands-on-accessibility-print-validation.md)
   has not been executed by a person.
9. **Six Dependabot alerts remain open** on the default branch as of 2026-09-01
   (two high, two moderate, two low). Static triage found one model-loading
   alert that needs focused review and five that are not actionable in the
   documented local MinerU path. No alert was dismissed and no dependency was
   changed; see
   [Dependabot triage](docs/quality/2026-09-01-post-merge-qualification.md#dependabot-static-triage).
10. **Four owner decisions remain open:** OQ-010, OQ-013, OQ-014, and OQ-016.

The predecessor repository remains intact. Canonical source provenance and the
deliberate copy/rewrite/omit decisions live in
[`docs/migration/source-manifest.md`](docs/migration/source-manifest.md). The
original foundation evidence is recorded in
[`docs/operations/2026-08-25-hosted-foundation.md`](docs/operations/2026-08-25-hosted-foundation.md).

## Stack decision

The app uses **Next.js**, which is a React framework—not a competing UI library.
A plain Vite React SPA would preserve more of the old build unchanged, but it
would force sensitive authentication, authorization, policy retrieval, AI calls,
and database orchestration into a separate backend. Next.js keeps the existing
React component model while adding server-only boundaries, route handlers,
secure cookie integration, and first-class Vercel deployment.

Target services:

- **Vercel:** Next.js web application and short server-side request handlers.
- **Supabase:** PostgreSQL 17, Auth, private Storage, Queues, full-text search,
  and `pgvector`.
- **OpenAI initially:** accessed through provider-neutral generation and
  embedding interfaces. No Google hosting or Google-specific runtime is part of
  the target.
- **Optional non-Google worker:** only if measured document-generation, OCR, or
  long-running jobs cannot fit safely within Vercel function limits.

### Cost reality

The current goal is a private, single-facility Production app for a small
invited group. Any selected Vercel and Supabase plans must have terms,
protection, recovery, and retention controls that support the authorized use.
Real operational and personal data are permitted only in isolated Production
after the release gates pass; see
[`docs/operations/real-data-governance.md`](docs/operations/real-data-governance.md).
OpenAI API calls are usage-priced and still need a small budget and circuit
breaker.

Current plan terms and eligibility must be rechecked at provisioning and before
promotion: [Vercel Hobby plan](https://vercel.com/docs/plans/hobby),
[Supabase billing](https://supabase.com/docs/guides/platform/billing-on-supabase),
and [OpenAI API pricing](https://platform.openai.com/pricing).

See [`ARCHITECTURE.md`](ARCHITECTURE.md) and the architecture decision records
under [`docs/adr`](docs/adr/README.md) for the full reasoning.

## Prerequisites

- Node.js 22 LTS or newer within the supported range in `package.json`
- npm 11+
- Docker Desktop only when running the local Supabase stack
- Authenticated Vercel and Supabase CLIs only when linking or provisioning cloud
  resources

Do not place credentials in committed files. Copy `.env.example` to `.env.local`
and fill it from the appropriate local or hosted secret store.

## Local web checks

```powershell
npm ci
npm run lint
npm run typecheck
npm test
npm run build
```

After environment linkage is complete, run the web app with:

```powershell
npm run dev
```

The liveness endpoint is `/api/health/live`. A successful liveness response does
not prove database, authentication, AI, or RAG readiness.

When local Supabase is already running, this reset-free check builds a temporary
local server with only the local public Supabase settings and verifies public
previews plus unauthenticated protected-route gates. It does not create data or
reset the local database:

```powershell
npm run test:e2e:local-public
```

`npm run test:e2e:local-auth` remains the separate, broader fictional
authenticated qualification and deliberately resets the local database.

## Local database checks

The Supabase commands require Docker and must never target a hosted production
project by accident.

```powershell
npm run db:start
npm run db:reset
npm run db:lint
npm run db:test
npm run db:stop
```

Local seed data is explicitly fictional. Hosted migrations and production data
changes follow
[`docs/operations/database-migrations.md`](docs/operations/database-migrations.md).

## Documentation map

- [`PRODUCT.md`](PRODUCT.md): product scope, users, non-negotiable behavior, and
  feature status
- [`ARCHITECTURE.md`](ARCHITECTURE.md): target system and trust boundaries
- [`SECURITY.md`](SECURITY.md): security model, reporting, and release blockers
- [`ROADMAP.md`](ROADMAP.md): gated implementation sequence
- [`docs/OWNER_DECISIONS.md`](docs/OWNER_DECISIONS.md): confirmed choices,
  assumptions, and owner questions that block later phases
- [`docs/product`](docs/product/principles.md): roles, workflows, terminology,
  and parity inventory
- [`docs/migration`](docs/migration/README.md): source audit, RAG transfer,
  cutover, rollback, and Google Cloud retirement
- [`docs/operations`](docs/operations/README.md): environments, deployment,
  backups, incidents, monitoring, and cost controls
- [`docs/quality`](docs/quality/README.md): tests, fictional-data rules,
  accessibility, print, and definition of done
- [`AGENTS.md`](AGENTS.md): mandatory instructions for coding agents

## Product rules that do not bend

- AI never invents, silently corrects, or balances operational facts.
- Policy answers retain source, version, page/section, and immutable source
  hashes.
- Nothing is filed, submitted, acknowledged, or made official without an
  authorized person reviewing the result and taking the explicit action.
- Revisions are append-only; restores create new revisions.
- Browser code never receives Supabase secret/service credentials or direct
  unrestricted application-table access.
- Preview and automated-test environments use fictional operational data only.
- Production records use the owner-approved two-year retention rule, subject to
  legal hold and verified deletion.
- A green build is not a deployment, pilot approval, or production
  authorization.

## License and data rights

This is a private, all-rights-reserved project. Source documents in the RAG
corpus retain their original ownership and handling restrictions; their presence
in an approved storage system does not grant permission to publish them.
