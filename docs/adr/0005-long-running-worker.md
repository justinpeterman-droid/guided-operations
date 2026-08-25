# ADR-0005: Add a Durable Worker Only When Workload Qualification Requires It

- **Status:** Proposed
- **Date:** 2026-08-25
- **Deciders:** Product owner, technical lead, and security owner

## Context

The product needs potential OCR, corpus ingestion, embedding batches,
deterministic DOCX/PDF/ZIP exports, and AI jobs. Vercel functions have plan-
dependent duration, memory, package, filesystem, concurrency, and payload
limits. Supabase Queues provides durable messages but still needs a consumer.
The target should stay simple and low-cost without pretending that unbounded
document work fits an interactive request.

Any worker host must be non-Google.

## Proposed decision

Start with durable database job/outbox state and Supabase Queues regardless of
executor. Qualify each job class in staging.

- Execute short, bounded, interruption-safe jobs on Vercel when comfortably
  within current limits.
- Introduce one privately configured non-Google durable worker only when a
  required workload crosses the documented activation criteria.
- Keep queue/job/provider/storage interfaces independent of the executor.
- Do not select the worker provider until measurements require it.

The ADR moves to Accepted with either:

1. evidence that all required jobs fit Vercel and the decision that no worker is
   needed; or
2. an approved provider/runtime/security/cost design for one worker.

## Options considered

### Option A: All work in Vercel functions

| Dimension                 | Assessment                      |
| ------------------------- | ------------------------------- |
| Simplicity                | High                            |
| Cost at low use           | Potentially low                 |
| Long/native document work | Risky until measured            |
| Queue consumption         | Requires an invocation strategy |

Pros:

- One deployment provider.
- Shared TypeScript/domain code.

Cons:

- Hard duration/memory/package/temp limits.
- No natural continuously polling process.
- OCR/Python/native libraries and bulk exports may not fit.
- A timeout can waste provider work without careful idempotency.

### Option B: Supabase Edge Functions consume all jobs

| Dimension             | Assessment                                 |
| --------------------- | ------------------------------------------ |
| Platform count        | Low                                        |
| Runtime compatibility | Limited for existing Python/document stack |
| Long work             | Plan/runtime constrained                   |

Pros:

- Close to database/queues.
- One platform for data and background functions.

Cons:

- Edge/runtime limits and library compatibility need qualification.
- Still not a universal long-document worker.

### Option C: One dedicated non-Google worker

| Dimension              | Assessment                 |
| ---------------------- | -------------------------- |
| Workload fit           | Strong                     |
| Operational complexity | Medium                     |
| Cost                   | Additional service         |
| Python/native support  | Strong, provider dependent |

Pros:

- Supports polling, OCR, Python document fidelity, resumable batches, and longer
  work.
- Isolates resource-heavy work from user traffic.

Cons:

- Another deployable, secret set, alert surface, patching path, and bill.
- Provider/network/availability decision required.

### Option D: Synchronous browser request for all work

Rejected. It couples user connections to long work, lacks durable recovery, and
encourages unsafe retries.

## Activation criteria

One worker becomes required if a necessary job:

- needs a continuously available queue consumer;
- approaches Vercel's current duration/memory/package/temp/payload limits;
- uses OCR or Python/native document tooling not safely qualified on Vercel;
- creates large or bulk artifacts;
- needs resumable batches or long provider waits;
- materially harms interactive concurrency/cost.

Measure worst-case source documents and failure/retry paths, not just a happy
small fixture.

## Trade-off analysis

Prematurely adding a worker creates avoidable operations. Refusing one despite
measured limits creates fragile jobs. A stable job/queue boundary lets the
project defer the provider without deferring correctness.

## Consequences

- Job/outbox/queue design is implemented before executor selection.
- Queue messages are ID-only and completion is idempotent/stale-safe.
- Python document code may be retained only in the worker boundary.
- The worker has no public product endpoint and uses least-privileged
  credentials.
- A provider decision must cover US region, patching, scaling-to-zero,
  availability, logs, secrets, networking, backups, cost, and exit/export.
- Vercel/Supabase free tiers are validated; they are not used to deny measured
  worker need.

## Action items

1. [ ] Define representative worst-case document/AI workloads.
2. [ ] Implement durable jobs, outbox, queue contract, leases, and idempotency
       tests.
3. [ ] Benchmark duration, memory, package/temp use, concurrency, interruption,
       and cost on Vercel.
4. [ ] Decide no-worker or evaluate non-Google worker providers.
5. [ ] If selected, write deployment/threat model/runbook and qualify
       restore/retry behavior.
6. [ ] Update this ADR to Accepted with evidence and the chosen execution path.
