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

## Vercel project and production attempt

- Team: `justin-peterman-s-projects` (Justin Peterman's projects)
- Project: `guided-operations` (`prj_BMU1Piqg20muXIC1PzcdF3Cvig0i`)
- The public Supabase URL and publishable key were added as non-sensitive
  configuration for Development, Preview, and Production. No server secret,
  OpenAI key, database password, or service-role key was added.
- The owner confirmed the private GitHub repository was connected in the Vercel
  project settings after commit `2ddccf1`. The next Git push is the first
  deployment-event verification for that connection.

On 2026-08-25, the local Vercel production build completed successfully. The
prebuilt upload failed while Vercel processed a generated Next.js error-page
artifact (`ENOENT` under `.vercel/output/functions`); the standard Vercel
production deploy fallback created deployment `dpl_79pt5uYLDy94G8GPB22Btc8MEFLb`
but remained `UNKNOWN` in the Vercel CLI after several minutes. Its deployment
URL served Vercel authentication rather than the application, its expected
production alias returned 404, and no runtime logs were available. It is
therefore **not a verified production release** and must not be presented as a
live application.

## Still open

- Authorize Vercel's GitHub integration for the private repository, or document
  a reviewed manual deployment procedure.
- Resolve the Vercel deployment state/alias before retrying production.
- Confirm the aligned Vercel function region.
- Configure hosted Supabase Auth to disallow public self-signup before any
  account workflow is built. This cannot be established by the database
  migration and was not changed in this foundation pass.
- Verify the live page and `/api/health/live` with a real browser, including
  console errors and failed assets.
- Keep sign-in disabled until ADR-0003 and its negative security tests pass.
- Keep the RAG corpus out of the hosted project until the corpus migration gate
  is approved and reconciled.
