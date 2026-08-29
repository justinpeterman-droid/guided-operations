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

As of 2026-08-29, this is an implementation foundation moving into the secure
login milestone, not a completed release.

| Area                  | State                                                                                                               |
| --------------------- | ------------------------------------------------------------------------------------------------------------------- |
| GitHub repository     | Private replacement repository; GitHub Actions is currently failing before runner assignment, with no steps started |
| Web foundation        | Next.js 16 App Router and React 19 scaffolded                                                                       |
| Accepted appearance   | Guided Operations navy/gold design tokens established                                                               |
| Migrated product code | Count Sheet calculations, schema parser, types, and tests                                                           |
| Database              | Foundation migration applied to Supabase Free in `us-east-1`; application tables remain empty                       |
| Authentication        | Opaque employee-session architecture accepted in ADR-0007; implementation and security tests are in progress        |
| RAG corpus            | Not copied; inventory, rights, hashing, page mapping, and reconciliation are required first                         |
| Vercel                | Git-connected authoritative project verified at `https://guided-operations.vercel.app`; foundation page is live      |
| Supabase              | Project healthy; private schemas, forced RLS, private buckets, `pgcrypto`, and `pgvector` established               |

The live foundation page and `GET /api/health/live` were remotely verified.
Sign-in remains disabled until Milestone 1's credential, session, authorization,
RLS, and browser-security gates pass. Owner decisions O-012 through O-014 have
resolved the individual-passcode floor, initial administrator authority, and
hobby-boundary MFA decision.

The predecessor repository remains intact. Canonical source provenance and the
deliberate copy/rewrite/omit decisions live in
[`docs/migration/source-manifest.md`](docs/migration/source-manifest.md). Hosted
foundation evidence is recorded in
[`docs/operations/2026-08-25-hosted-foundation.md`](docs/operations/2026-08-25-hosted-foundation.md).

## Stack decision

The app uses **Next.js**, which is a React framework—not a competing UI library.
Next.js keeps sensitive authentication, authorization, policy retrieval, AI
calls, and database orchestration behind server-only boundaries while preserving
the React component model and first-class Vercel deployment.

Target services:

- **Vercel:** Next.js web application and bounded server-side request handlers.
- **Supabase:** PostgreSQL 17, private Storage, Queues, full-text search, and
  `pgvector`.
- **Application-owned authentication:** employee number plus individual passcode,
  Argon2id credential hashing, opaque browser sessions, and least-privileged
  direct Postgres roles as defined by ADR-0007.
- **OpenAI initially:** accessed through provider-neutral generation and
  embedding interfaces. No Google hosting or Google-specific runtime is part of
  the target.
- **Optional non-Google worker:** only if measured document-generation, OCR, or
  long-running jobs cannot fit safely within Vercel function limits.

### Cost reality

The current goal is a personal, non-commercial hobby app for a small invited
group of officers—not an agency or facility system. Vercel Hobby and Supabase
Free are therefore the starting candidates, provided the exact use remains
within their current terms and quotas. This does not authorize real operational
data. Any later official adoption requires a fresh plan, vendor, security,
records, and recovery review. OpenAI API calls are usage-priced and still need a
small budget and circuit breaker.

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
npm run verify:web
npm run build
```

Vercel preview builds also execute `npm run verify:web` before `next build`, so
formatting, lint, type checking, and unit/component tests remain a deployment
build gate even if GitHub Actions is temporarily unavailable.

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
- Browser code never receives database credentials, passcode/session hashes,
  server secrets, AI keys, or direct unrestricted application-table access.
- Preview and automated-test environments use fictional operational data only.
- A green build is not a deployment, pilot approval, or production
  authorization.

## License and data rights

This is a private, all-rights-reserved project. Source documents in the RAG
corpus retain their original ownership and handling restrictions; their presence
in an approved storage system does not grant permission to publish them.
