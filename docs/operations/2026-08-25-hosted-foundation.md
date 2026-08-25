# Hosted foundation record — 2026-08-25

This record is deployment evidence for the non-operational hobby foundation. It
does not approve user accounts, real operational data, corpus import, a public
production release, or official facility use.

## Source

- GitHub repository: private `justinpeterman-droid/guided-operations`
- Application commit deployed to preview:
  `2be84e094599445ff9b4c0a0fae25e536d96864e`
- Web quality workflow: passed formatting, lint, TypeScript, unit tests, and
  production build for that commit
- Database quality workflow: replayed the foundation migration and fictional
  seed, passed database lint, and passed pgTAP on the parent commit; the only
  later source change was a web layout type annotation

## Supabase

- Organization: `justinpeterman-droid's Org`
- Project name: `guided-operations`
- Project reference: `mfkunfqhosmrjbreythc`
- Plan quote confirmed by owner: USD 0 monthly
- Region: `us-east-1`
- Observed state after creation: `ACTIVE_HEALTHY`
- Hosted migration: `20260825125137_foundation`

Verified after migration:

- the `api` and `app_private` schemas exist;
- all nine application tables are empty and have RLS enabled and forced;
- `anon` and `authenticated` have zero table grants and zero routine grants in
  `app_private`; no application access policies exist yet;
- `pgcrypto` and `vector` are installed in `extensions`;
- `policy-sources` and `generated-exports` are private buckets;
- the security advisor reports no warnings or errors. Its informational
  `rls_enabled_no_policy` findings are the intended deny-all foundation state;
- performance-advisor unused-index notices are expected before application
  traffic exists.

No hosted seed, user account, policy object, embedding, or operational record
was created.

## Vercel preview

- Project/deployment name: `guided-operations`
- Target: Preview
- Deployment ID: `dpl_CucTc646Xb5eXuvAFD6EeHacnPct`
- Protected URL:
  `https://guided-operations-1muqapseb-justinpeterman-3079.vercel.app`
- Vercel returned the deployment in `INITIALIZING` state. A later
  unauthenticated request reached Vercel deployment protection rather than
  application content.

The preview remains incomplete evidence because the available project connector
could not inspect the deployment or generate a temporary access link. Do not
claim the application page or liveness route is remotely verified from this
preview. The same commit passed local production-browser checks at desktop and
mobile sizes.

## Still open

- Link the Vercel project to the private GitHub repository.
- Configure the Supabase project URL and publishable key in Vercel environment
  settings without committing values.
- Confirm the aligned Vercel function region.
- Obtain explicit production-promotion approval, then deploy the exact accepted
  artifact.
- Verify the live page and `/api/health/live` with a real browser, including
  console errors and failed assets.
- Keep sign-in disabled until ADR-0003 and its negative security tests pass.
- Keep the RAG corpus out of the hosted project until the corpus migration gate
  is approved and reconciled.
