# Command-center and hosted requalification — 2026-08-27

This record captures the exact repository, CI, Vercel, and fictional Development
state after the secure officer command-center work. The checks were read-only
except for the already-authorized branch push. No Production deployment,
Production environment change, hosted migration, identity change, or real-data
operation was performed.

## Exact candidate and automated checks

- Branch: `codex/production-readiness`.
- Inspected branch head: `264d5ae9de8e59b3f4972bb09474660ac5a9f301`.
- The officer command-center implementation is commit
  `2600a5d7e0ed3cc4ac3f32553fbe09544de24589`; the later branch-head commit adds
  the owner-approved experience-design brief without changing runtime code.
- GitHub Web quality run `33127250201`, Database quality run `33127250225`, and
  Recovery rehearsal run `33127250181` passed on the exact branch head.
- The branch worktree and remote branch were aligned when this evidence was
  captured.
- A complete security diff review covered all 29 changed files and reported no
  new security finding. This is change-specific evidence, not a claim that all
  product or external-configuration gates are closed.

## Protected Preview

- The latest Vercel Preview was `READY`, built commit `264d5ae`, and ran in
  `iad1`.
- The generated Preview URL remained behind Vercel Authentication for an
  unauthenticated request. An authorized request reached the application and the
  value-free readiness endpoint returned `ready`.
- A real browser rendered the application sign-in page with employee-number and
  passcode fields, a Sign in button, and the required statement that public
  registration and password recovery are unavailable.
- Desktop and 390 by 844 phone checks found 48-pixel fields and button, no
  horizontal overflow, and no browser console warning or error.
- The authenticated officer and administrator flows remain open because the
  fictional administrator must personally replace the temporary passcode before
  the protected roster workflow can create a fictional officer.

## Fictional Development database

- A value-free, read-only database query found 62 applied migrations with head
  `20260827120000`; this exactly matched the 62 repository migration files and
  their local head at the time of the check.
- A count-only account query found one active fictional administrator and no
  other account. The administrator still had `must_change_passcode=true`.
- Preview's four Supabase connection entries were compared inside a temporary
  process and matched the ignored local fictional Development configuration. No
  connection value was displayed or written to evidence.

## Production isolation stop condition

- Vercel Production currently has only `SUPABASE_DB_URL` and
  `SUPABASE_SECRET_KEY` from the required application configuration.
- A value-free process comparison proved both Production-scoped entries are the
  same as the fictional Development entries. They must not remain associated
  with Production before a later release build.
- The remaining required Production configuration is absent, so the current
  application readiness contract would fail closed if this branch were promoted.
- The existing public Production deployment is the older foundation commit
  `c8bfd1687d6e0a4a3b341667d65de5348152606b`, created on
  `2026-08-26T04:40:14.002Z`. Its liveness route returns HTTP 200, while its
  readiness route returns HTTP 404 because that deployment predates readiness.
  It is not a release candidate and contains no authorized real operational
  data.

Do not promote another Production deployment while Development credentials are
Production-scoped. Removing those two Production associations is an external
configuration change and requires exact authorization. Later Production setup
must use a separate isolated Supabase project and a complete, freshly generated
Production-only configuration.

## Next executable gate

The owner completes the fictional administrator's temporary-passcode change at
the local sign-in page. The protected administrator workflow can then create a
fictional officer, after which the full officer/admin browser, authorization,
accessibility, responsive, print, and degraded-provider qualification can run.
