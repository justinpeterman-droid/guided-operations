# Hosted readiness refresh — 2026-08-28

## Scope

This is a read-only provider-state refresh for the `codex/production-readiness`
candidate. It did not deploy, change traffic, modify environment variables,
apply migrations, create accounts, import policy content, or write operational
data.

## Vercel evidence

- The repository-local Vercel link names the `guided-operations` project in the
  previously recorded owner team.
- The app-level Vercel connector can see the owner Hobby team but lists no
  projects, and a direct connector read of the linked project returns
  `404 Not Found`.
- The official Vercel CLI 59.7.0 is authenticated as the expected owner and can
  read the authoritative project. It confirms Next.js, Node.js 24.x, `iad1`,
  Git-fork protection, and SSO protection for deployment URLs except custom
  domains.
- Git integration produced a `READY` protected Preview for exact commit
  `06848a1`. Authenticated Preview checks return `200` for `/`,
  `/api/health/live`, `/api/health/ready`, `/login`, `/home`, `/reports`,
  `/policy-expert`, `/admin`, and `/admin/accounts`. The bounded readiness body
  is `{"service":"guided-operations-web","status":"ready"}`.
- A later read-only check confirmed exact commit `3caaca7` at Vercel deployment
  `dpl_9zr7qxEPBgDcFBbiEnd9XZostBoe`. It is `READY`, targets Preview, runs its
  functions in `iad1`, and retains the protected branch alias
  `guided-operations-git-codex-producti-c58718-justinpeterman-3079.vercel.app`.
  Authenticated CLI requests returned `200` for `/` and the same bounded
  readiness body. This is fictional Preview evidence, not Production promotion,
  live account creation, or real-data authorization.
- Environment-name inventory, without reading values, shows the full expected
  Development/Preview runtime contract. Production has only `SUPABASE_DB_URL`
  and `SUPABASE_SECRET_KEY`; it is intentionally incomplete and must not be used
  to build a Production candidate.
- Independent unauthenticated HTTPS checks show that the canonical domain still
  serves the historical foundation: `/` and `/api/health/live` return `200`,
  while `/api/health/ready`, `/sign-in`, `/officer`, and `/admin` return `404`.
  The liveness body remains the bounded
  `{"service":"guided-operations-web","status":"ok"}` response.

The connector mismatch is an integration limitation rather than lost Vercel
account access. The authenticated CLI supplies the current read-only evidence;
no relink, deployment, environment change, or protection change was performed.

The public status checks prove only that the old foundation still answers. They
do not prove that the current candidate is deployed, protected, ready, or
connected to the intended environment.

## Supabase evidence

- The connected Supabase provider session can read the linked
  `guided-operations` Development project.
- The project is `ACTIVE_HEALTHY`, uses PostgreSQL 17, and is in `us-east-1`.
- Hosted migration history contains 62 ordered migrations through
  `20260827120000_enforce_report_finalization_authority`.
- The repository contains 71 migrations through
  `20260828151000_add_daily_paperwork_template_packages`; nine additive
  migrations remain unapplied to Development.
- No separately named or isolated Guided Operations Production project exists in
  the connected organization.

The pending Development migrations were not applied. They require the recorded
non-production approval path and a fresh local/CI replay first. Development is
fictional-only and is not an acceptable real-data target.

## Provider security-advisor review

The Development project currently reports:

- 31 informational `rls_enabled_no_policy` notices for forced-RLS tables in the
  non-exposed, no-direct-grant `app_private` schema;
- 28 warnings for authenticated `SECURITY DEFINER` routines in the reviewed
  `api` schema; and
- one warning that leaked-password protection is disabled.

A read-only catalog query checked all 28 reviewed API routines. Every routine
has an empty search path, anonymous callers cannot execute it, the elevated Data
API role cannot execute it, no private helper is directly executable by an
authenticated caller, and every routine contains a reviewed session-
authorization anchor. These provider warnings describe the intentional narrow
RPC boundary; they do not replace the function-level positive and negative pgTAP
tests.

The leaked-password-protection warning is an unresolved hosted authentication
setting. It must be enabled and rechecked in isolated Production before real
accounts or data are allowed.

`supabase/tests/provider_security_advisor.test.sql` now makes the generic RPC
privilege, search-path, private-helper, and authorization-anchor checks part of
database qualification so a newly exposed routine cannot silently widen this
boundary.

## Current candidate qualification infrastructure

Commit `06848a1` added the provider-advisor boundary test and this evidence. All
four GitHub workflows failed before a runner or any workflow step started; the
job records contain no steps and show runner ID zero. The last exact branch
commit for which all four workflows actually ran and passed is `0f3f72b7` at
16:34 UTC on 2026-08-28. Beginning with the next branch commit, every Web,
Database, Recovery, and Authenticated-browser workflow has failed in about four
seconds without a runner, including all four runs for current pushed commit
`3caaca7`. No workflow file changed between the green and zero-step commits.
GitHub's public service status was operational during the refresh. This proves
the latest red checks are an external GitHub Actions runner/allocation/account
gate rather than an executed code-test failure; the exact account-side reason is
not yet independently readable with the current token permissions. The release
gate remains open until the workflows actually execute and pass.

A local fallback was also attempted. Docker Desktop 4.81 failed before engine
startup while initializing its optional Model Runner socket, so the local
Supabase stack could not run. No database, Storage object, hosted setting, or
application data was changed. Do not replace the required executable CI/local
proof with the read-only hosted catalog query.

The later readiness-observability working tree based on `3caaca7` passed the
complete non-database local web gate: formatting, ESLint, TypeScript, 210 Vitest
files and 655 tests passed with one intentionally skipped file/test, all 52
operations tests passed, and the optimized Next.js 16.3.2 Production build
completed. The tracked-secret scan found no pattern and the production
dependency audit found no vulnerability. A dedicated six-file security diff
review found no reportable issue in the generic health response or content-free
readiness event. The database-type and production-data-inventory checks now stop
after 15 seconds and report the unavailable local stack instead of hanging; they
remain failed gates until Docker and local Supabase are healthy.

Commit `907f386` did pass the then-current complete non-database local web gate
using the pinned repository tools. Later local candidate evidence supersedes
those counts and is recorded in the production execution checklist. Local
success narrows the infrastructure gap but does not replace database, recovery,
authenticated-browser CI, or manual visual qualification.

The connected Supabase organization is on the Free plan, and the Vercel project
is on Hobby. The existing plan/protection/availability/backup decision therefore
remains a required owner gate before real-data Production.

## Release effect

The code candidate remains qualified only by local/CI fictional-data evidence.
The following gates remain open:

1. complete a protected-Preview browser inspection and correct the intentionally
   incomplete Production environment only under the Production configuration
   gate;
2. replay and qualify the nine pending migrations before any approved
   Development apply;
3. create and configure a separate isolated Production Supabase project under
   exact owner authorization;
4. enable and verify Production authentication hardening, backup/restore,
   monitoring, policy-corpus, smoke, rollback, and observation gates; and
5. record owner approval for the exact release commit and deployment.
