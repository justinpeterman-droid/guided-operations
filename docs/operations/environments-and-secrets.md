# Environments and secrets

## Environment strategy

The minimum safe topology uses two hosted Supabase projects and Vercel's
built-in environments. The current use is a personal, non-commercial hobby app
for a small invited group of officers, so Vercel Hobby and Supabase Free are the
starting candidates. Their quotas and exact plan terms must still be rechecked
before provisioning. Any later official organizational adoption requires a new
plan and readiness review.

| Environment        | Application                                          | Data services                                                                | Allowed data                                                                            | Promotion model                                                         |
| ------------------ | ---------------------------------------------------- | ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Local              | `next dev`                                           | Local Supabase CLI stack                                                     | Fictional fixtures; approved corpus only when needed                                    | Developer controlled                                                    |
| Preview            | Vercel Preview per pull request on an eligible plan  | Shared non-production Supabase project                                       | Fictional, namespaced test records; approved corpus copy if required                    | Automatic application build after CI; no remote migration automatically |
| Staging-equivalent | A pinned, Vercel-protected release-candidate Preview | Same non-production Supabase project, reset/reseeded to the candidate schema | Fictional qualification fixtures and approved corpus                                    | Manual candidate designation                                            |
| Production         | Vercel Production environment on an eligible plan    | Separate live Supabase project                                               | Owner-authorized real operational/personal data and approved corpus after release gates | Explicit owner promotion                                                |

Supabase preview branches provide stronger per-pull-request isolation but are
currently a paid feature. If enabled later, each branch gets isolated database,
Auth, Storage, and credentials. Until then:

- preview tests use unique run identifiers and clean up only their own rows and
  objects;
- a pull request must not alter the shared non-production schema automatically;
- migration candidates are replayed locally and in CI first;
- only a designated release candidate may be applied to the shared
  non-production project;
- concurrent schema candidates are serialized;
- a drifted non-production project is rebuilt from migrations and fictional seed
  data, never copied from production.

This shared non-production arrangement is acceptable only because operational
data is prohibited. Add a dedicated staging project or paid branch isolation
before concurrent teams, real-data testing, or facility pilot use makes shared
state unsafe.

## Region

Select an exact US region and record it in an ADR before project creation. The
initial assumption is:

- Supabase: East US (`us-east-1`);
- Vercel Functions: Washington, D.C. (`iad1`), which is aligned with
  `us-east-1`;
- static assets: Vercel's CDN, with private policy documents remaining in a
  private Supabase Storage bucket.

Region selection is a latency and data-location decision, not proof of legal or
regulatory compliance. **OWNER/EXTERNAL:** confirm the facility's residency,
records, procurement, and vendor requirements before any operational data is
permitted. Changing a Supabase project region generally requires migration to a
new project, so confirm before production provisioning.

## Private access

The app is private because every application route and data operation requires
authenticated authorization, not because its production URL is undiscoverable.

- Enable Vercel Standard Protection for preview and generated deployment URLs
  when available on the selected plan.
- Production must still enforce Supabase Auth and RLS. Provider deployment
  protection does not replace application authentication or database controls.
- Never place sensitive content in statically generated pages, browser bundles,
  public Storage buckets, cache keys, source maps, or error pages.
- Fail closed when session verification, role lookup, or facility membership
  cannot be established.
- Keep policy documents in private Storage. Use authenticated downloads or
  short-lived signed URLs only after authorization.

If owner requirements demand provider-level protection of the production domain
in addition to application authentication, confirm the required paid Vercel
protection before launch.

## Environment variable inventory

Names are a contract; actual values belong in local ignored files, Vercel
environment settings, Supabase secrets, or protected GitHub environments.

| Variable                                     |         Local |       Preview/staging |                       Production | Classification                                                     |
| -------------------------------------------- | ------------: | --------------------: | -------------------------------: | ------------------------------------------------------------------ |
| `NEXT_PUBLIC_SUPABASE_URL`                   |           yes |                   yes |                              yes | Public endpoint, environment-specific                              |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`       |           yes |                   yes |                              yes | Public low-privilege key; RLS remains mandatory                    |
| `SUPABASE_SECRET_KEY`                        |      optional |           server only |                      server only | **Secret**, elevated and RLS-bypassing                             |
| `SUPABASE_DB_URL` or migration credentials   | local/CI only |          protected CI | protected production environment | **Secret**, migration tooling only; not browser/runtime by default |
| `AI_PROVIDER`                                |           yes |                   yes |                              yes | Non-secret provider selector                                       |
| `AI_MODEL` / embedding model identifiers     |           yes |                   yes |                              yes | Non-secret configuration; pin and record in releases               |
| `AI_API_KEY` or provider-specific server key |  local server |           server only |                      server only | **Secret**; never `NEXT_PUBLIC_*`                                  |
| `RAG_CORPUS_VERSION`                         |           yes |                   yes |                              yes | Non-secret immutable manifest/version identifier                   |
| `APP_ENV`                                    |           yes |                   yes |                              yes | Non-secret guard against cross-environment writes                  |
| `APP_ORIGIN`                                 |           yes |                   yes |                              yes | Non-secret exact allowed origin                                    |
| `EMPLOYEE_LOOKUP_PEPPER`                     |  local server |           server only |                      server only | **Secret**; keys employee-number lookup without storing raw values |
| `AUTH_DUMMY_ALIAS`                           |  local server |           server only |                      server only | **Secret**; fixed timing-defense identity, never browser-visible   |
| `CSRF_HMAC_KEY`                              |  local server |           server only |                      server only | **Secret**; environment-specific session-bound CSRF signing key    |
| `INCIDENT_IDEMPOTENCY_HMAC_KEY`              |  local server |           server only |                      server only | **Secret**; hashes retry keys without retaining their raw values   |
| `AUTH_SIGN_IN_ENABLED`                       |           yes |                   yes |                              yes | Non-secret fail-closed feature gate; enabled only after auth proof |
| backup destination credentials               |            no | protected operator/CI |            protected operator/CI | **Secret**, separate from runtime credentials                      |

Prefer Supabase publishable and secret API keys for new work; legacy `anon` and
`service_role` JWT keys are not the target. A Supabase secret key bypasses RLS
and is used only in narrowly scoped server administration or backup code after
an authorization check. Most user requests should carry the authenticated user's
JWT so RLS evaluates the user directly.

## Secret rules

1. Never reuse a key across non-production and production.
2. Never store values in Git, documentation, tickets, screenshots, test output,
   shell history, or build artifacts.
3. Never log request headers, cookies, tokens, signed URLs, database URLs,
   prompts, document bodies, or provider responses.
4. Scope Vercel variables to Development, Preview, or Production explicitly. A
   changed variable affects only new builds; record which deployment contains
   it.
5. Keep migration and backup credentials outside Vercel runtime unless the
   application truly needs them.
6. Use GitHub environment protection for production migration secrets and
   require owner approval.
7. Inventory owner, purpose, environment, creation date, last rotation, and
   consumers without recording the value.
8. Rotate after suspected exposure, personnel/access change, provider
   recommendation, or at least annually; exercise emergency rotation before
   pilot.
9. Validate old-key revocation after rotation. Creating a replacement does not
   necessarily revoke a legacy key.

## Cross-environment safety checks

Before any remote command, record and verify:

- target Vercel team/project/environment;
- target Supabase organization/project reference/region;
- current Git commit and migration head;
- whether the command is read-only, additive, or destructive;
- backup/evidence location;
- owner approval when production is involved.

Never run a linked remote reset against production. Supabase CLI commands have
different local/linked defaults; pass the target explicitly and verify the
linked project before a destructive operation.

## Free-plan qualification gate

Free services are appropriate only where their terms permit the exact use.
Before the private hobby release, the owner must explicitly accept or eliminate
these limitations:

- a low-activity Supabase Free project can pause;
- free database backups require regular operator-managed logical exports;
- database backups do not include Storage objects;
- Vercel Hobby permits personal, non-commercial use only; the owner must keep
  this app within that classification or change plans before the use changes;
- lower Vercel tiers can have short runtime-log retention;
- provider-level protection of the production custom domain may require a paid
  Vercel plan;
- OpenAI API use is usage-priced independently of hosting plans.

If these prevent the approved recovery, availability, security, or evidence
objectives, upgrade before launch. A free-plan preference is not authority to
weaken a release gate.

Recheck the official [Vercel Hobby plan](https://vercel.com/docs/plans/hobby)
and
[Supabase billing](https://supabase.com/docs/guides/platform/billing-on-supabase)
terms at provisioning and before every live promotion.
