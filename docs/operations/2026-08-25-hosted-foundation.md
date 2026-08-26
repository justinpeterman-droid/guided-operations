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
- Hosted migrations: `20260825125137_foundation` and
  `20260825170000_incident_report_foundation`, followed by
  `20260825222811_account_lifecycle_guards` and
  `20260825230000_enforce_report_revision_heads`, followed by
  `20260825233000_add_idempotency_records` and
  `20260825234000_add_auth_attempt_guards`

Verified after migration:

- the `api` and `app_private` schemas exist;
- all fourteen application tables are empty and have RLS enabled and forced;
- incident/report heads, immutable incident/report revisions, and report-access
  relationships are present but have no application policies or grants yet;
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

The account-lifecycle migration is also verified in the Development project: the
private `user_accounts` trigger exists, its guard has no executable grant to
public/Data API roles, and it retains the intended default-deny RLS posture. The
provider security advisor reports only the expected informational no-policy
notices for the still-unexposed `app_private` foundation tables.

The incident/report revision-head migration is also verified in Development: the
four private serialized trigger functions use `SECURITY DEFINER` with an empty
search path and have no execute grants to public or Data API roles. They allow
only consecutive immutable revisions and advance the matching incident or report
head after insertion. This is persistence-integrity groundwork only; it does not
add a browser-accessible mutation path, accounts, records, or RLS policies.

The idempotency migration is also verified in Development: the private retry
control table has forced default-deny RLS, and its lifecycle guard uses
`SECURITY DEFINER` with an empty search path and no execute grants to public or
Data API roles. It preserves opaque request and key digests plus safe result
metadata only; it stores no request body, narrative, credential, or model
response content. This is groundwork for a future server-side mutation path; it
grants no runtime account or browser access.

The authentication-attempt migration is also verified in Development: its
short-lived private rate-limit metadata accepts only keyed subject digests and
never raw employee numbers, IP addresses, device identifiers, aliases, or
passcodes. RLS is enabled and forced, with no table access for anonymous,
authenticated, or service roles. The provider advisor's no-policy notice is
expected for this intentionally default-deny internal table.

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

## Authoritative Vercel production foundation

The Git-connected Vercel project under `justinpeterman-3079` is the
authoritative project for this repository. Its production deployment
`dpl_FxygRKNYSLFB1yAsPZ8JtM8VEJvm` built commit
`1491cff133f766939ac60384a2f4923a68808d13` successfully in 13 seconds.

- Canonical URL: `https://guided-operations.vercel.app`
- The live homepage was inspected in a real browser: it renders the intended
  foundation screen, keeps both sign-in fields and the sign-in button disabled,
  and reported no console errors.
- The live `GET /api/health/live` endpoint returned HTTP 200 with
  `{"service":"guided-operations-web","status":"ok"}`.

This is a verified, no-data foundation release. It does not approve accounts,
operational data, corpus import, or official facility use.

## Connected protected Preview — 2026-08-25

- Application commit: `94dfd61`
  (`fix: probe public Supabase readiness endpoint`)
- Deployment ID: `dpl_EkjZg7P2BqZ1CD8Q5Aqner6CtuKJ`
- Target: protected Vercel Preview; it is not Production traffic.
- Preview variables are scoped only to Preview: `APP_ENV=preview`, the
  Development Supabase URL, and its browser-safe publishable key. No database
  password, service-role key, or other server secret was added.
- Remote verification through Vercel's authenticated access path returned the
  intended foundation page, `GET /api/health/live` `200`/`ok`, and
  `GET /api/health/ready` `200`/`ready`.
- Readiness deliberately probes Supabase Auth's public settings endpoint. The
  Data API root correctly rejects publishable keys on this project and is not
  used as a readiness signal.

Development Supabase Auth was also checked in the hosted dashboard: public
signup, manual account linking, and anonymous sign-in are disabled; email
confirmation is enabled. The Site URL is `https://guided-operations.vercel.app`
and the redirect allow-list contains the canonical Vercel URL, the Vercel
Preview wildcard, and local development. Supabase does not expose a separate
hosted toggle that disables password recovery while retaining email/password
sign-in. The application must therefore never expose or invoke recovery until an
approved private reset ceremony exists.

## Secondary Vercel project

An additional project was created under `justin-peterman-s-projects`
(`prj_BMU1Piqg20muXIC1PzcdF3Cvig0i`) during setup. Its CLI deployment remained
`UNKNOWN` and it is not the Git-connected or authoritative project. Its public
Supabase URL and publishable key configuration must not be treated as production
configuration for the authoritative project.

## Still open

- Confirm the aligned Vercel function region.
- Do not expose or invoke password recovery until the approved private reset
  ceremony is implemented; hosted Supabase has no separate recovery-disable
  setting while email/password sign-in remains enabled.
- Keep sign-in disabled until ADR-0003 and its negative security tests pass.
- Keep the RAG corpus out of the hosted project until the corpus migration gate
  is approved and reconciled.

## Preview refresh — 2026-08-26

Read-only Vercel CLI verification confirmed the authoritative linked account is
`justinpeterman-3079` and the project remains `guided-operations`. The newest
observed protected Preview was ready at
`https://guided-operations-2hwat2jq2-justinpeterman-3079.vercel.app` and built
Git commit `dd1bce3` in Vercel region `iad1`.

The Preview variable inventory showed the expected browser-safe Supabase URL and
publishable key plus server-only credential, CSRF, lookup, and idempotency
values. Values were not read or recorded. `APP_ORIGIN` was not separately set;
this is valid for Preview because `getRuntimeEnvironment` derives the exact
HTTPS origin from Vercel's `VERCEL_URL` only when `APP_ENV=preview`.

This verifies build linkage and configuration inventory only. It does not prove
that local commits after `dd1bce3`, hosted database migrations, authenticated
routes, or the application UI are deployed or remotely browser-verified.
