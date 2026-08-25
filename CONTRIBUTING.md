# Contributing to Guided Operations

Guided Operations is a private, web-only application for one facility.
Contributions must preserve a simple rule: **no real operational records,
personnel records, incident narratives, credentials, or production exports
belong in this repository, tests, screenshots, logs, or preview environments.**
The approved policy/reference corpus is the only real content currently allowed,
and it has its own handling rules in
[`docs/quality/fictional-data-and-rag-content.md`](docs/quality/fictional-data-and-rag-content.md).

This repository is at foundation stage. Documentation describes required
controls; it does not prove that Vercel, Supabase, CI, backups, monitoring, DNS,
or production access have been configured.

## Before starting

1. Read `AGENTS.md` and the relevant product, architecture, operations, and
   quality documents.
2. Start from an up-to-date branch. Do not work directly on the protected
   production branch once branch protection exists.
3. State the intended behavior, affected authorization boundary, schema impact,
   and evidence needed before editing.
4. Use fictional fixtures. If work needs the approved real policy corpus, use
   the private corpus path and never copy it into a public fixture, prompt
   transcript, issue, or screenshot.

## Local checks

Use the scripts defined in package.json. The current baseline includes:

```powershell
npm run check       # formatting, lint, types, unit/component tests, and build
npm run test:e2e    # browser suite; requires its configured app/environment
npm run db:test     # database suite; requires the local Supabase stack
```

The more specific test commands described in
[`docs/quality/testing-strategy.md`](docs/quality/testing-strategy.md) are
desired contracts and coverage categories; some may currently be grouped under
npm test rather than exposed as separate scripts. A script existing does not
prove the required coverage exists. Until a required check and CI job exist and
pass, that release gate is **blocked**, not waived.

Database development must use the local Supabase stack once it is added. Schema
changes are made through committed SQL migrations, replayed from an empty local
database, and tested against real PostgreSQL with RLS enabled. Never experiment
against production.

## Change rules

- Keep changes narrow and explain any cross-cutting effect.
- Preserve server/client boundaries. A Supabase secret key or AI provider key
  must never enter browser code or a `NEXT_PUBLIC_*` variable.
- Treat RLS as the authorization boundary. Application filtering is not a
  substitute.
- Use short transactions, deterministic lock ordering, unique constraints, and
  atomic upserts. Do not hold a database transaction open across an AI or
  network request.
- Make mutations retry-safe with idempotency keys where duplicate execution
  could create a second record, job, export, or audit event.
- Use expansion/contraction migrations for breaking schema changes. An
  application rollback must remain compatible with the deployed schema.
- Never edit production data, provider settings, DNS, secrets, billing, or
  deployment aliases merely because a code change is ready.
- Do not regenerate visual snapshots in bulk. Inspect and approve each
  intentional change.
- Do not commit generated build output, local Supabase state, downloaded
  backups, runtime logs, credentials, or provider exports.

## Pull request evidence

Every pull request should include:

- the user-visible outcome and affected roles;
- security and data-classification impact;
- migration, RLS, Storage-policy, and rollback impact, or `none` with a reason;
- tests added or changed and the exact commands run;
- screenshots for intentional visual changes, using fictional data only;
- print evidence when a printable surface changes;
- accessibility evidence when interaction, layout, color, focus, or
  announcements change;
- AI evaluation evidence when retrieval, prompts, models, citations, schemas, or
  fallback behavior change;
- documentation updated;
- known limitations and any owner or external gate still open.

Use the Definition of Done in
[`docs/quality/definition-of-done.md`](docs/quality/definition-of-done.md).
Green CI means repository checks passed; it does not authorize a production
deployment, database migration, policy-corpus publication, real-data use, DNS
change, or GCP retirement.

## Review and release

At least one independent review is required for authentication, RLS, migrations,
Storage policies, AI grounding, exports, audit behavior, and deployment workflow
changes. The repository owner separately approves production promotion and any
external-state change.

Release procedure, evidence, and rollback triggers live in:

- [`docs/operations/release-gates.md`](docs/operations/release-gates.md)
- [`docs/operations/deployment-and-rollback.md`](docs/operations/deployment-and-rollback.md)
- [`docs/operations/database-migrations.md`](docs/operations/database-migrations.md)

## Security reports

Do not open a public issue containing a suspected vulnerability, secret, private
deployment URL, policy document, user identifier, or log excerpt. Notify the
repository owner privately, preserve evidence without copying sensitive
payloads, and follow
[`docs/operations/incident-response.md`](docs/operations/incident-response.md).
