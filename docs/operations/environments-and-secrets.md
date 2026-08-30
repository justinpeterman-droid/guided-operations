# Environments and secrets

## Environment strategy

The minimum safe topology uses two hosted Supabase projects and Vercel's
built-in environments. The selected Vercel and Supabase plans must permit the
exact invited-user and owner-authorized real-data Production use and meet the
documented protection, backup, recovery, retention, monitoring, and support
gates. Any later official organizational adoption requires a new plan and
readiness review.

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

| Variable                                                                                               |                           Local |                 Preview/staging |                        Production | Classification                                                                                                                     |
| ------------------------------------------------------------------------------------------------------ | ------------------------------: | ------------------------------: | --------------------------------: | ---------------------------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`                                                                             |                             yes |                             yes |                               yes | Public endpoint, environment-specific                                                                                              |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`                                                                 |                             yes |                             yes |                               yes | Public low-privilege key; RLS remains mandatory                                                                                    |
| `SUPABASE_SECRET_KEY`                                                                                  |                        optional |                     server only |                       server only | **Secret**, elevated and RLS-bypassing                                                                                             |
| `SUPABASE_DB_URL`                                                                                      |                    local server |                     server only |                       server only | **Secret**; current private RPC/auth adapter connection                                                                            |
| `SUPABASE_MIGRATION_DB_URL`                                                                            |                              no |                              no | protected GitHub environment only | **Secret**; dedicated production migration connection, never a Vercel runtime value                                                |
| `AI_PROVIDER`                                                                                          |                             yes |                             yes |                               yes | Non-secret provider selector                                                                                                       |
| `AI_GENERATION_ENABLED`                                                                                |                             yes |                             yes |                               yes | Non-secret emergency gate; `false` stops provider calls                                                                            |
| `AI_MONTHLY_REQUEST_CAP` / `AI_BUDGET_STOP_PERCENT`                                                    |                             yes |                             yes |                               yes | Non-secret owner-approved cap and stop point; required by readiness                                                                |
| `AI_ACCOUNT_MONTHLY_SHARE_PERCENT` / `AI_ACCOUNT_SHORT_WINDOW_MAX`                                     |                        optional |                        optional |                          optional | Non-secret fair-use limits; safe defaults are 5% monthly and 6/minute per operation                                                |
| `AI_ACCOUNT_CONCURRENCY_MAX` / `AI_REQUEST_LEASE_SECONDS`                                              |                        optional |                        optional |                          optional | Non-secret concurrency controls; safe defaults are 2 calls and a 90-second lease                                                   |
| `OPENAI_POLICY_MODEL` / `OPENAI_REPORT_DRAFT_MODEL` / `OPENAI_EMBEDDING_MODEL`                         |              when AI is enabled |              when AI is enabled |                when AI is enabled | Non-secret configuration; pin and record in releases                                                                               |
| `OPENAI_EMBEDDING_DIMENSIONS` / `POLICY_EMBEDDING_PROFILE_KEY`                                         |              when AI is enabled |              when AI is enabled |                when AI is enabled | Non-secret immutable profile binding; must match the enabled database profile                                                      |
| `OPENAI_API_KEY`                                                                                       | when AI is enabled, server only | when AI is enabled, server only |   when AI is enabled, server only | **Secret**; never `NEXT_PUBLIC_*`                                                                                                  |
| `OPENAI_DATA_CONTROLS_APPROVAL_REF` / `OPENAI_DATA_RETENTION_MODE` / `OPENAI_API_DATA_SHARING_ENABLED` |              when AI is enabled |              when AI is enabled |                when AI is enabled | Non-secret fail-closed attestation bound to an operator-reviewed OpenAI project; the approval reference must contain no credential |
| `OPENAI_ADMIN_KEY` / `OPENAI_PROJECT_ID` / `OPENAI_DATA_CONTROLS_CHECK_ENABLED`                        |                              no |                              no |      protected operator host only | The Admin key is a **secret** used only by the manual project-retention verifier; never place it in application runtime            |
| `RAG_CORPUS_VERSION`                                                                                   |                             yes |                             yes |                               yes | Non-secret immutable manifest/version identifier                                                                                   |
| `SAFE_OPERATIONAL_LOGGING_ENABLED`                                                                     |                             yes |                             yes |                               yes | Non-secret fail-closed gate; required `true` in Production                                                                         |
| `APP_ENV`                                                                                              |                             yes |                             yes |                               yes | Non-secret guard against cross-environment writes                                                                                  |
| `APP_ORIGIN`                                                                                           |                             yes |                             yes |                               yes | Non-secret exact allowed origin                                                                                                    |
| `EMPLOYEE_LOOKUP_PEPPER`                                                                               |                    local server |                     server only |                       server only | **Secret**; keys employee-number lookup without storing raw values                                                                 |
| `AUTH_DUMMY_ALIAS`                                                                                     |                    local server |                     server only |                       server only | **Secret**; fixed timing-defense identity, never browser-visible                                                                   |
| `AUTH_SESSION_ENCRYPTION_KEY`                                                                          |                    local server |                     server only |                       server only | **Secret**; exact random 32-byte base64url key for the encrypted session envelope                                                  |
| `CSRF_HMAC_KEY`                                                                                        |                    local server |                     server only |                       server only | **Secret**; environment-specific session-bound CSRF signing key                                                                    |
| `INCIDENT_IDEMPOTENCY_HMAC_KEY`                                                                        |                    local server |                     server only |                       server only | **Secret**; hashes retry keys without retaining their raw values                                                                   |
| `AUTH_SIGN_IN_ENABLED`                                                                                 |                             yes |                             yes |                               yes | Non-secret fail-closed feature gate; enabled only after auth proof                                                                 |
| production backup database, Storage and destination credentials                                        |                              no |                              no |      protected operator host only | **Secret**; separate from runtime/migration credentials and prohibited in CI                                                       |
| production backup age recipient                                                                        |                              no |                              no |      protected operator host only | Public encryption recipient; private identity/key remains separately controlled                                                    |

The protected GitHub environment named `production-database` also owns three
non-secret fail-closed variables: `PRODUCTION_MIGRATION_ENABLED=true`, the exact
`SUPABASE_PROJECT_REF`, and `SUPABASE_PROJECT_REGION=us-east-1`. These values do
not authorize a run by themselves. The environment must require the owner as a
reviewer, limit deployment branches to the approved release path, and contain
only the dedicated migration credential. Repository-level migration secrets are
not an acceptable substitute.

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
5. Keep migration and backup credentials outside Vercel runtime. Production
   backup credentials are also prohibited in CI and developer environments; only
   the protected operator host may receive them.
6. Use GitHub environment protection for production migration secrets and
   require owner approval.
7. Inventory owner, purpose, environment, creation date, last rotation, and
   consumers without recording the value.
8. Rotate after suspected exposure, personnel/access change, provider
   recommendation, or at least annually; exercise emergency rotation before
   pilot.
9. Validate old-key revocation after rotation. Creating a replacement does not
   necessarily revoke a legacy key.
10. Never reuse `AUTH_SESSION_ENCRYPTION_KEY` for employee lookup, CSRF,
    idempotency, backups, or any provider key. Rotation has no overlap window:
    it invalidates all existing application cookies, so schedule it as a
    sign-in-again event and verify old cookies fail closed.

The public readiness endpoint validates this runtime contract and the Supabase
public API probe but returns only `ready` or `not_ready`. It never returns a
missing variable name or value. When `AI_GENERATION_ENABLED=false`, readiness
does not require an unused OpenAI key or model names; the provider adapters deny
before reading them and AI routes return the documented temporary-unavailable
state. Enabling AI immediately makes the key, all pinned models, an opaque
approval reference, an approved Zero Data Retention or Modified Abuse Monitoring
mode, and explicit `OPENAI_API_DATA_SHARING_ENABLED=false` mandatory. The
application cannot prove a provider-dashboard setting from an ordinary project
API key, so an operator must verify the exact OpenAI project and record the safe
approval reference before enabling AI. The reference must never contain an API
key, project credential, policy text, or personnel data. Production readiness
also requires `AUTH_SIGN_IN_ENABLED=true` and
`SAFE_OPERATIONAL_LOGGING_ENABLED=true`, while Preview may keep both gates
disabled until their qualification evidence is ready.

### OpenAI project data-control proof

OpenAI documents that normal API traffic is not used for training unless the
customer explicitly opts in, while default abuse-monitoring retention can still
last up to 30 days. Approved organizations/projects can select Zero Data
Retention or Modified Abuse Monitoring. The project-level setting is available
through an Admin API, which requires a separate Admin key rather than the
application's project API key. See the official
[OpenAI data controls](https://platform.openai.com/docs/models/default-usage-policies-by-endpoint)
and
[project retention API](https://developers.openai.com/api/reference/python/resources/admin/subresources/organization/subresources/projects/subresources/data_retention/methods/retrieve).

On the protected operator host, set the following only for the verification
process, after confirming in the OpenAI dashboard that API data sharing is off:

```powershell
$env:OPENAI_DATA_CONTROLS_CHECK_ENABLED = "true"
$env:OPENAI_ADMIN_KEY = "<temporary operator-only Admin key>"
$env:OPENAI_PROJECT_ID = "<exact application project id>"
$env:OPENAI_DATA_RETENTION_MODE = "<approved exact mode>"
$env:OPENAI_API_DATA_SHARING_ENABLED = "false"
npm run openai:data-controls:check
```

The command returns only the verified retention mode and the recorded
data-sharing-disabled state. It never returns the Admin key or project ID and
does not read or transmit policy content. The OpenAI Admin API proves the remote
retention mode; API data-sharing status remains a dashboard/operator check until
an authoritative provider API exposes it. Remove the Admin key from the shell
immediately after collecting release evidence.

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
Before the real-data Production release, the owner must eliminate or explicitly
accept only those limitations that the release gates permit owner judgment on:

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
