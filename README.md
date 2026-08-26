# Guided Operations

Guided Operations is the private, web-only replacement for `prison-policy-ai`.
It is designed for one correctional facility and brings incident reports,
operational paperwork, forms, and cited policy guidance into one review-first
workspace.

This repository contains no live operational records. The only real source
material in the predecessor system is its policy/reference RAG corpus; that
corpus is not copied into Git and must pass the documented inventory,
classification, rights, hashing, and citation-reconciliation process before it
is imported.

## Current state

As of 2026-08-26, this is an implementation candidate, not a production release.

| Area                  | State                                                                                                                                                     |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GitHub repository     | Private replacement repository created; earlier web/database CI passed, while the current local candidate awaits push and remote CI                       |
| Web foundation        | Next.js 16 App Router, React 19, protected report/paperwork routes, and local production build                                                            |
| Accepted appearance   | Guided Operations navy/gold design tokens established                                                                                                     |
| Migrated product code | Count Sheet calculations, schema parser, types, and tests                                                                                                 |
| Database              | Foundation migration applied to a new Supabase Free project in `us-east-1`; application tables remain empty                                               |
| Authentication        | Guarded employee-number/passcode, local sign-out, and account-wide sign-out routes built; sign-in remains fail-closed by default, with no hosted accounts |
| RAG corpus            | Not copied; inventory and reconciliation are required first                                                                                               |
| Vercel                | Protected Preview and scoped environment inventory verified for an earlier commit; current local candidate is not pushed or deployed                      |
| Supabase              | Project healthy; private schemas, forced RLS, private buckets, `pgcrypto`, and `pgvector` established                                                     |

The predecessor repository remains intact. Canonical source provenance and the
deliberate copy/rewrite/omit decisions live in
[`docs/migration/source-manifest.md`](docs/migration/source-manifest.md). Hosted
foundation evidence is recorded in
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

The current goal is a personal, non-commercial hobby app for a small invited
group of officers. Vercel Hobby and Supabase Free are starting candidates only
if their current terms, protection, recovery, and retention controls support the
authorized production use. Real operational and personal data are permitted only
in Production after the release gates pass; see
[`docs/operations/real-data-governance.md`](docs/operations/real-data-governance.md).
OpenAI API calls are usage-priced and still need a small budget and circuit
breaker.

Current plan terms must be rechecked at provisioning time:
[Vercel Hobby plan](https://vercel.com/docs/plans/hobby),
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
