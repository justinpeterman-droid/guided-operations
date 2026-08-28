# Observability and cost controls

Observability must answer whether the private application is available,
authorized correctly, grounded in the approved corpus, recoverable, and within
its budget without collecting operational content.

## Telemetry boundary

Application telemetry may include:

- timestamp, environment, deployment ID, commit SHA, request/correlation ID;
- route template or operation name, status class, duration, retry count;
- Supabase project/environment identifier and migration/corpus version;
- model/provider alias, token counts, latency, retrieval result count, citation
  count, and refusal category;
- a one-way, rotating pseudonymous actor/session identifier when required for
  abuse detection.

Never log:

- passwords, PINs, session tokens, cookies, API keys, connection strings, or
  signed URLs;
- raw prompts, model responses, retrieved chunks, policy text, uploads,
  filenames, or document bodies;
- real names, employee numbers, resident identifiers, incident narratives,
  facility operational counts, or other real operational data;
- full SQL parameters, authorization headers, or browser storage.

Errors must use stable codes and sanitized context. Debug logging is
time-bounded, environment-scoped, owner-approved in production, and reviewed
before activation.

## Implemented application boundary

The sign-in, local sign-out, sign-out-all, personal passcode-change, forced
temporary-passcode-change, policy-answer, report-draft, policy-source,
incident-fact, and Daily Paperwork package endpoints now emit a strict JSON
event only when `SAFE_OPERATIONAL_LOGGING_ENABLED=true`. The schema accepts only
a fixed operation, bounded outcome/reason code, random request ID, status,
duration, environment, deployment/build identifiers, and the policy route's
bounded citation count and corpus version. Every newly observed authentication
lifecycle response returns the same opaque random ID in `X-Request-Id`; the
Daily Paperwork package route also returns it in response metadata. These events
record no employee number, account/user/session identifier, passcode, cookie,
source filename, source metadata, package digest, administrator identity,
form/report content, or arbitrary error text. Sign-in intentionally records no
account-existence reason. Tests reject extra prompt, response, report,
credential, personnel, and operational-source fields and prove that passcode
values never enter the event call.

Production readiness fails while this gate is off. Telemetry delivery failure
does not change the user's application response. This implements the
application-side redaction boundary; it does **not** prove that hosted log
retention, access, dashboards, alerts, destinations, or test notifications are
configured. Those remain live-environment qualification gates.

## Signals and checks

| Area      | Minimum signal                                                                                                     | Qualification                                                                  |
| --------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| Web       | deployment health, route error rate, p50/p95 latency, synthetic authenticated smoke                                | Vercel observability/runtime logs plus an independent scheduled smoke          |
| Auth      | sign-in, passcode-change, local/global sign-out outcome and duration; refresh/revocation failures; suspicious rate | No account IDs, credentials, cookies, or user content in the event             |
| Retention | legal-hold placement/release and deletion approval/execution outcome and duration                                  | No target IDs, administrator IDs, proof tokens, authority or backup references |
| Database  | connection usage, slow queries, lock waits/deadlocks, migration version, RLS negative-test result                  | Supabase logs/advisors and explicit test evidence                              |
| Storage   | upload/download failure, signed-link/authenticated access failures, inventory/backup reconciliation                | Private-bucket RLS tests                                                       |
| RAG/AI    | retrieval latency, citation presence, refusal category, provider errors, tokens/cost, corpus version               | Synthetic continuous checks; secure real-corpus qualification before promotion |
| Recovery  | age and checksum of latest database and Storage backup; last restore drill result                                  | Separate database and object evidence                                          |
| Security  | dependency/secret scan, authorization test, unexpected public asset check                                          | Blocking alerts for confirmed exposure                                         |

## Alert policy

The following starting thresholds are provisional and must be tuned from
measured baselines:

- **Immediate:** suspected secret exposure; successful anonymous or cross-user
  access; public private-bucket object; any real operational data detected;
  corpus integrity mismatch; an unsupported answer presented without the
  required refusal/citation behavior.
- **High:** core authenticated smoke failure; production 5xx rate at or above 2%
  for five minutes; repeated authentication or RLS errors; failed backup or
  restore qualification.
- **Warning:** p95 latency above twice the qualified baseline for 15 minutes;
  database connections above 80% of the plan limit; Storage/database usage above
  75% of quota; AI spend above a planned threshold.
- **Budget:** notify at 50%, require owner review at 75%, and stop or degrade
  nonessential AI work at 90% of the monthly cap.

Every alert needs an owner, private destination, severity, runbook link,
deduplication window, and test record. No alert is considered active until a
test notification has been received.

## Provider-plan qualification

- The selected Vercel plan must permit the exact invited-user and real-data
  Production use. Recheck eligibility before promotion and whenever access,
  ownership, funding, or purpose changes. The selected plan and any supplemental
  telemetry must preserve enough evidence for incident investigation.
- A Supabase Free project may be paused for low activity and may not provide the
  required managed backup/recovery controls. Real-data Production is blocked
  until the selected plan meets the approved availability, recovery, and
  retention objectives.
- Supabase Free and Vercel Hobby impose service and eligibility limits. OpenAI
  API use is usage-priced. The owner must review current provider terms and the
  AI budget before each live promotion.

Current provider limits can change. Verify them against the official
[Vercel logs documentation](https://vercel.com/docs/logs),
[Supabase platform backups documentation](https://supabase.com/docs/guides/platform/backups),
and
[Supabase billing FAQ](https://supabase.com/docs/guides/platform/billing-faq)
when qualifying an environment.

## Cost controls

### Vercel and Supabase

- Keep one explicitly named shared non-production Supabase project and one
  isolated live Production project only while their selected plans and limits
  qualify. Do not create hidden long-lived environments.
- Pin the Vercel and Supabase regions together to avoid unnecessary latency and
  data transfer.
- Set database statement timeouts, bounded pagination, indexes for policy/RLS
  columns, and pooled runtime connections.
- Set upload size, MIME type, object count, and retention limits.
- Delete expired preview artifacts only through an approved retention process;
  never delete backups or evidence merely to lower usage.
- Review database, egress, Storage, function, log, and monthly active user usage
  at least weekly during a pilot.

### AI

- Put model/provider access behind a server-only adapter; browsers never receive
  provider credentials.
- Every policy-answer and report-draft provider call first reserves one slot in
  the shared private PostgreSQL limiter using the already-authorized opaque
  account UUID. The atomic reservation enforces both the global monthly ceiling
  and per-account fair-use controls. It stores no name, employee number, prompt,
  response, citation, incident, report, or policy content.
- `AI_GENERATION_ENABLED=false`, a failed budget check, or reaching
  `AI_BUDGET_STOP_PERCENT` of `AI_MONTHLY_REQUEST_CAP` prevents the provider
  request. The API returns an honest temporary-unavailable message while
  authentication, policy browsing, forms, and saved records remain available.
- The fail-closed defaults limit one account to 5% of the effective monthly
  total, six requests per operation per minute, two concurrent provider calls,
  and a 90-second crash-recovery lease. Configure these with
  `AI_ACCOUNT_MONTHLY_SHARE_PERCENT`, `AI_ACCOUNT_SHORT_WINDOW_MAX`,
  `AI_ACCOUNT_CONCURRENCY_MAX`, and `AI_REQUEST_LEASE_SECONDS`; the monthly
  share cannot exceed 20%, so one account cannot consume the shared total.
- Provider requests receive an abort deadline five seconds shorter than their
  database concurrency lease. A still-running request therefore cannot outlive
  its lease and silently free another concurrency slot.
- Keep request timeout, retry cap with jitter, maximum input/retrieval/output
  tokens, and maximum retrieved chunks bounded.
- Cache only provider-neutral answers that contain no user or operational
  content. Key the cache by corpus version, retrieval configuration, model
  alias, and prompt-template version.
- Reject requests when the approved corpus cannot support an answer; do not
  spend more tokens to invent one.
- Track cost per qualified request and daily/monthly aggregate without storing
  the request text.
- Keep the OpenAI project budget and alerts as a second independent control. The
  repository breaker counts requests, not currency or tokens, so the owner must
  still approve the monthly request cap, stop percentage, models, provider spend
  limit, and alert thresholds before Production is enabled.

## Dashboards and reviews

Maintain three views:

1. **Reliability:** health, latency, errors, provider state,
   deployment/migration/corpus versions.
2. **Safety and quality:** auth/RLS/Storage negatives, citations/refusals,
   corpus integrity, backup age, restore drill.
3. **Cost and capacity:** quota use, connections, Storage, egress, AI
   tokens/cost, projected month end.

Before production, the owner must approve who can view telemetry and how long
each signal is retained. Review access quarterly, thresholds monthly, and plan
limits before releases that materially change usage.
