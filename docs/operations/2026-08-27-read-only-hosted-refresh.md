# Read-only hosted readiness refresh — 2026-08-27

This record captures provider state without changing Vercel, Supabase, hosted
data, identities, migrations, traffic, or Production configuration. It is
planning evidence only and does not authorize deployment or real-data use.

## Repository and CI

- Repository access was verified for the private
  `justinpeterman-droid/guided-operations` repository.
- The inspected local branch head was `c8a1e9292172219bf52f2f3feb6bc55a4751fd81`
  on `codex/production-readiness`.
- The remote branch remained at `823d44a7388154504f14dc3e80f0cd2cf34a2e33`. The
  local head was not pushed because its security review found an unresolved
  high-severity report attribution issue.
- Web quality, database quality, and recovery rehearsal were green on the remote
  head. Those runs do not qualify the newer unpushed local head.

## Vercel state

- Authenticated access to `justinpeterman-3079/guided-operations` was verified.
- The project uses the Next.js preset, Node.js 24.x, and the `iad1` function
  region.
- Current Production deployment `dpl_G83HsSdCRdvnpikhebigtmK4QYLp` was `Ready`
  and served `https://guided-operations.vercel.app`.
- A read-only request to `/api/health/live` returned HTTP 200 with the expected
  service health response.
- `/api/health/ready` returned HTTP 404 because the current Production
  deployment predates the readiness route. Production is therefore not a
  qualified release candidate.
- Recent branch deployments were `Ready` Preview deployments. This status alone
  is not authenticated browser, database, or release evidence.

### Latest protected Preview check

- Preview deployment `dpl_E5YGKWZmu6iJYU9zTocyGJsNYUZs` was `READY` and ran its
  server functions in `iad1`.
- Protection-aware read-only requests returned HTTP 200 and
  `Cache-Control: no-store` for both `/api/health/live` and `/api/health/ready`.
- A real browser rendered `/login` with the private-workspace heading,
  employee-number field, passcode field, sign-in button, and explicit copy that
  public registration and password recovery are unavailable.
- The browser recorded no console warning or error on the rendered login page.
- At the default desktop viewport, all three controls were 48 pixels high and
  the page had no horizontal overflow.
- At a temporary 390 by 844 phone viewport, the login card fit between 14-pixel
  side margins, all three controls remained 48 pixels high, and the document
  width stayed exactly 390 pixels with no horizontal overflow. The viewport was
  reset after the check.
- Browser screenshot capture was unavailable in the selected browser, so this
  check retains rendered DOM, layout, and console evidence but no pixel image.
  Authenticated officer/admin Preview qualification remains open.

## Environment-name inventory

The Vercel inventory was inspected by variable name and scope only. No secret
value was read, copied, or written.

- Preview contains the current Supabase public/server connection names,
  authentication/session/CSRF/idempotency controls, and fail-closed AI, logging,
  sign-in, budget, and corpus-version gates.
- Development contains no Vercel environment variables.
- Production currently contains only `SUPABASE_SECRET_KEY` and `SUPABASE_DB_URL`
  from the required application set.
- Production still lacks the public Supabase URL/key, `APP_ENV`, `APP_ORIGIN`,
  authentication/session/CSRF/idempotency controls, safe logging gate, AI gates
  and limits, approved corpus version, and pinned provider configuration.
- Production values must be generated for the isolated Production services.
  Preview values must not be copied into Production.

## Supabase state

- Authenticated account access was verified.
- `guided-operations` and `guided-operations-auth-spike` were `ACTIVE_HEALTHY`,
  in `us-east-1`, on PostgreSQL 17.
- An older unrelated project was inactive.
- This checkout is not CLI-linked to a hosted project. A linked migration
  dry-run therefore stopped before making any connection or change.
- No hosted migration, reset, seed, identity creation, Storage operation, or
  configuration change was performed.
- A separate isolated Production Supabase project was not present in the
  authenticated project inventory.

## Current stop conditions

1. Obtain explicit approval to fix the cross-officer report-finalization flaw,
   then rerun the exact local and security qualification.
2. Push the approved fix and require green web, database, and recovery CI on the
   exact new head.
3. Explicitly authorize linking this checkout to the named fictional-data
   Development project before any hosted migration dry-run or qualification.
4. Create and configure a separate isolated Production Supabase project and
   complete the Production Vercel variables only during the controlled release
   process.
5. Complete the approved corpus evaluation, database and Storage restore
   rehearsal, monitoring and alerts, rollback proof, production smoke tests,
   observation window, and exact-candidate owner approval.
