# Release gates

A release passes only when all applicable automated checks and human/external
gates have evidence. A merged pull request or successful Vercel build is not
production authorization.

## Gate ownership

| Gate                                                   | Type                  | Required evidence                                                            |
| ------------------------------------------------------ | --------------------- | ---------------------------------------------------------------------------- |
| Lint, typecheck, unit and component tests              | AUTOMATED             | CI job links for the exact commit                                            |
| Clean Next.js production build                         | AUTOMATED             | Build log and immutable deployment identifier                                |
| Migration replay from empty local database             | AUTOMATED             | Supabase local reset job and migration list                                  |
| PostgreSQL constraints/index/schema tests              | AUTOMATED             | Database test report against supported Postgres                              |
| RLS and Storage policy tests                           | AUTOMATED             | Anonymous, authenticated, cross-user, cross-role and elevated-key cases      |
| Auth/session/CSRF or origin-boundary tests             | AUTOMATED             | Integration and browser test report                                          |
| Contract and generated database-type drift             | AUTOMATED             | Contract job with no unexplained diff                                        |
| Concurrency, stale-write and idempotency tests         | AUTOMATED             | Parallel/retry test report                                                   |
| AI retrieval, citation, refusal and schema evaluations | AUTOMATED plus OWNER  | Machine scorecard and owner review of representative outputs                 |
| Functional browser smoke                               | AUTOMATED             | Protected preview URL, commit and Playwright report                          |
| Accessibility                                          | AUTOMATED plus MANUAL | Axe results plus keyboard, focus, zoom/reflow and screen-reader review       |
| Visual and print acceptance                            | AUTOMATED plus OWNER  | Reviewed snapshot diff and real print/PDF evidence using fictional data      |
| Secret, dependency and supply-chain scanning           | AUTOMATED             | Secret scan, dependency audit and action pinning results                     |
| Migration compatibility and recovery plan              | MANUAL                | Reviewed migration note, backup identifier and forward-fix/restore procedure |
| Product copy, workflow and design acceptance           | OWNER                 | Dated approval for the exact candidate                                       |
| Policy corpus version and use rights                   | OWNER/EXTERNAL        | Approved manifest, checksums, source and access classification               |
| Provider status, quota and plan limits                 | EXTERNAL              | Vercel, Supabase and AI provider checks captured at release time             |
| Production promotion                                   | OWNER                 | Explicit approval naming commit, deployment and migration set                |
| Operational-data enablement                            | OWNER/EXTERNAL        | Separate written authorization; prohibited until granted                     |
| DNS or domain change                                   | OWNER/EXTERNAL        | Approved target, TTL/rollback plan and post-change evidence                  |
| GCP traffic or resource retirement                     | OWNER/EXTERNAL        | All gates in `gcp-retirement.md`; separate destructive authorization         |

## Required release record

Create a dated release record before production promotion containing:

- release identifier and UTC timestamp;
- Git commit and reviewed pull requests;
- Vercel preview and candidate deployment identifiers;
- application configuration version, with no secret values;
- Supabase project reference alias, region and migration list;
- policy corpus manifest/version and AI provider/model identifiers;
- automated check links and manual evidence;
- known limitations and deferred risks;
- backup identifiers and restore-test date;
- rollback deployment and database compatibility statement;
- owner approval and operator;
- post-release observations and final outcome.

## Stop conditions

Do not promote when any of these is true:

- required test or script does not exist;
- migration/RLS behavior was tested only with mocks or SQLite;
- a visual baseline was regenerated without review;
- provider credentials, project identity, region, or migration target is
  uncertain;
- the rollback application cannot run against the post-migration schema;
- backup or Storage-object recovery is unverified;
- policy corpus provenance/checksums are incomplete;
- preview contains real operational or personnel data;
- error, latency, quota, or AI-cost signals are unavailable;
- unresolved critical/high security finding exists;
- owner or external approval is missing.

## Production qualification versus deployment

Qualification proves a candidate is eligible for owner consideration. Deployment
changes external state. Keep these separate:

1. CI passes.
2. Protected preview passes automated and manual qualification.
3. Staging-equivalent candidate passes migration, browser, AI, accessibility,
   visual, print, backup, and rollback checks.
4. Owner approves a named candidate.
5. Authorized operator performs production migration/promotion.
6. Operator verifies production and records observations.

Failure at step 5 or 6 does not retroactively make qualification false, but the
release is not complete and traffic must be restored or held according to the
rollback plan.
