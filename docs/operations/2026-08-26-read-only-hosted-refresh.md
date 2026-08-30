# Read-only hosted readiness refresh — 2026-08-26

This record captures provider state without changing Vercel, Supabase, hosted
data, identities, traffic, or Production configuration. It is evidence for
planning only, not release approval.

## Exact Preview candidate

- Branch head inspected: `44dc3bf2a3903c57d74d7ff2a1d3e0d4cc03bb0f` on
  `codex/production-readiness`.
- Vercel project: `justinpeterman-3079/guided-operations` in function region
  `iad1`.
- Preview deployment: `dpl_CcdbWX8nxLQafkVXdornocmhzTzQ`, status `Ready`.
- The Vercel deployment API mapped that deployment to the exact branch and
  commit above.
- An authenticated protection-bypass request returned HTTP 200 with `no-store`
  for both `/api/health/live` and `/api/health/ready`.
- The same protected request returned the `/login` page with employee number and
  personal passcode fields and explicit no-registration/no-recovery copy.

## Browser boundary

The available desktop browser was redirected to Vercel login before it could
render the protected Preview. That confirms the external protection boundary,
but it is not application visual, mobile, keyboard, accessibility, asset, or
console evidence. Those browser gates remain open until an approved
authenticated browser session can inspect the exact candidate.

## Environment-name inventory

The read-only Vercel inventory exposed names and scopes only; no values were
read or copied.

- Preview contains the current Supabase public/server connection names and the
  core authentication/CSRF/idempotency names used by the branch.
- Production currently lists only `SUPABASE_SECRET_KEY` and `SUPABASE_DB_URL`
  from the required application set.
- Production does not yet list the public Supabase URL/key, `APP_ENV`,
  `APP_ORIGIN`, employee lookup pepper, dummy alias, CSRF key, incident
  idempotency key, or sign-in feature gate.
- No OpenAI provider key or pinned generation/embedding model name appeared in
  the authoritative project's current Vercel inventory.

This missing Production configuration is an intentional stop condition. Do not
promote Production or enable sign-in until isolated Production values are added
through the protected provider workflow and a new exact deployment is qualified.

## Supabase state

- The authenticated Supabase account listed `guided-operations` as
  `ACTIVE_HEALTHY` in `us-east-1` on PostgreSQL 17.
- The repository is not CLI-linked to a hosted project. Therefore no hosted
  migration, reset, seed, or data mutation was run during this refresh.
- Local forward-migration replay, schema lint, pgTAP lifecycle tests, and
  anonymous/authenticated private-Storage denial tests pass. They remain local
  evidence until an explicitly approved hosted migration and fictional hosted
  qualification run.

## Remaining stop conditions

1. Finish and verify isolated Production environment values without reusing
   Preview secrets.
2. Approve and apply the exact forward migrations to the intended hosted
   environment, then run hosted Auth/RLS/Storage negative checks with fictional
   identities.
3. Complete signed-in desktop/mobile browser, keyboard, accessibility, asset,
   console, and print qualification.
4. Complete approved policy-corpus import/evaluation, database plus Storage
   backup/restore rehearsal, monitoring, rollback, and exact-candidate owner
   approval.
