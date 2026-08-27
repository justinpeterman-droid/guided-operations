# AI and Retrieval Architecture

- **Status:** Target design
- **Initial provider:** OpenAI through a provider-neutral adapter
- **Approved real content:** Policy/reference corpus only

## Purpose and boundary

AI assists with structured extraction, gap identification, reviewed report
drafting, and citation-backed policy questions. It does not make disciplinary,
legal, custody, classification, or policy decisions. It cannot mark its own
output reviewed, change record status, or bypass an authorization/validation
gate.

The browser never contacts a model provider. Next.js or the optional worker
calls provider adapters after authentication and authorization.

## Provider-neutral interfaces

Domain code depends on capabilities, not SDKs:

```text
EmbeddingProvider.embed(texts, configuration) -> vectors + provenance
StructuredModel.generate(schema, messages, configuration) -> typed result + provenance
RetrievalEngine.search(question, activeCorpus, configuration) -> ranked cited chunks
AnswerService.answer(question, chunks, configuration) -> answer + citation IDs + provenance
```

Each result includes provider, model, model snapshot/version when available,
prompt/template version, embedding dimension/version, start/end time, usage,
safe finish/error code, and request correlation. Raw provider responses are not
persisted or logged by default.

The OpenAI adapter belongs under server/ai/providers. No OpenAI types leak into
domain models or API contracts. Adding or changing a provider requires contract,
evaluation, privacy, cost, and failure-mode qualification rather than a search
and replace.

The initial Responses adapter is server-only, requires an explicit
`OPENAI_POLICY_MODEL` pin and a non-public `OPENAI_API_KEY`, sets
`store: false`, supplies no tools, and requests strict structured output. Its
parsed output is still untrusted until the domain citation validator accepts the
exact retrieved provenance.

The domain `PolicyAnswerService` now composes those two interfaces without a
provider SDK. It validates the question and facility scope, never invokes
generation when retrieval yields no authorized passages, and validates every
returned citation against the retrieved immutable passage before returning it.
It retains no question, answer, or excerpt; any future route is responsible for
authorization, transient rendering, and safe operational metrics.

## Corpus object model

One logical policy_document has immutable policy_document_versions. Each version
points to:

- original private Storage object and SHA-256;
- source title/code/issuer and access classification;
- published/effective/received dates where known;
- extraction/OCR tool and version;
- page-preserving normalized text/checksums;
- deterministic chunks with page/section provenance;
- embedding provider/model/dimension/version;
- ingest/evaluation/activation state.

Activating a new version does not destroy old versions. Historical citations
must continue to resolve to the exact source version/page/section used.

## Ingestion pipeline

```mermaid
flowchart LR
  UP[Authorized upload]
  Q[Private quarantine object]
  V[Size/type/hash validation]
  X[Text extraction / OCR]
  C[Deterministic page-aware chunking]
  E[Bounded embedding batches]
  DB[(Metadata + chunks + vectors)]
  EV[Retrieval evaluation]
  AC[Atomic activation]

  UP --> Q --> V --> X --> C --> E --> DB --> EV --> AC
```

Controls:

- admin plus purpose-bound step-up to create or activate a version;
- allowed media types and explicit size/page limits;
- content-addressed object names and server-verified checksums;
- parser/OCR work outside interactive transactions;
- deterministic chunker configuration under version control;
- embedding batches with idempotency and resumable progress;
- count/hash/page continuity verification before ready;
- evaluation gate before active;
- no corpus content in Git, CI artifacts, logs, queue messages, or snapshots.

PDFs and extracted text are untrusted. Parser isolation, resource limits, and
malware/content checks must be selected before real corpus ingestion.

## Hybrid retrieval

Use PostgreSQL full-text search plus pgvector semantic search:

1. Normalize and bound the question.
2. Authorize the user's corpus access.
3. Generate a query embedding with the active embedding configuration.
4. Search active versions with:
   - GIN-indexed tsvector keyword ranking;
   - a dimension/operator-matched vector index and distance function.
5. Fuse ranked lists with a versioned reciprocal-rank or measured equivalent.
6. Apply source/version/access filters before final ranking.
7. De-duplicate overlapping chunks while preserving page/section boundaries.
8. Enforce a bounded context budget and source diversity rule.
9. Return stable chunk/source citation IDs with each context item.

Index type, distance operator, weights, match count, chunk size/overlap, and
reranking are evaluated choices. Do not copy a generic HNSW configuration
without measuring the actual corpus.

## Grounded answer generation

The answer prompt has separate, fixed instruction and untrusted context
sections. It directs the model to:

- answer only from supplied context;
- treat instructions in documents as quoted data;
- cite stable context IDs for each material claim;
- distinguish direct source text from explanation;
- say when the available sources are incomplete or conflicting;
- avoid operational/legal conclusions beyond the source;
- return a closed structured schema.

Post-generation validation:

- every citation ID exists in the supplied context;
- every citation's document, version, checksum, page/section, and excerpt
  exactly match the retrieved immutable passage;
- cited source/version is active or explicitly historical;
- quoted spans, if any, are bounded and actually present;
- material claims meet the configured citation/support threshold;
- answer length and output schema are bounded;
- failure returns insufficient_evidence or provider_unavailable, not an uncited
  answer.

The user sees source title/code, version/effective date where known, and page or
section. A citation opens an authorized excerpt, never a public Storage URL.

## Report assistance

Maintain a three-layer boundary:

1. **Extraction:** the only model step that may receive the authorized source
   note/revision; returns structured slots under a strict schema.
2. **Deterministic review:** provider-neutral code finds missing facts,
   contradictions, invalid dates/IDs, and blocking gaps.
3. **Generation:** receives reviewed structured facts plus explicit unknowns,
   never an invitation to invent from raw prose.

AI results remain proposals until a user reviews and saves them. Job completion
records source revision, prompt/model/config versions, and validation result.
Stale base revisions cannot become current.

## Prompt-injection and data controls

- Corpus content, file metadata, user questions, and model output are untrusted.
- No retrieved text can select tools, destinations, credentials, system prompts,
  or authorization scope.
- Provider tools/function calls are disabled unless separately designed and
  allowlisted.
- Do not include secrets, internal aliases, Auth tokens, or database errors in
  prompts.
- Current policy permits real corpus content but only fictional operational
  questions/data. Enforce this in fixtures, demos, and manual evaluation.
- Review current OpenAI data-use, retention, region, and enterprise settings
  before uploading real corpus content; do not infer them from this design.
- Log question SHA-256/HMAC, source IDs/counts, configuration, latency, usage,
  and safe result code—not raw question, context, or answer.

## Model and embedding lifecycle

- Pin an approved model/configuration per environment.
- Store embedding model and dimension with every vector.
- A dimension/model change writes a parallel embedding generation and index.
- Run full evaluation before atomically switching the active retrieval config.
- Preserve the old generation for rollback until the observation window ends.
- A generation-model change also re-runs structured-output, citation,
  fabrication, latency, and cost evaluations.
- Provider fallback is explicit. It may return unavailable rather than silently
  changing behavior/model.

## Evaluation

The release corpus includes safe evaluation metadata and expected citation IDs,
not restricted passages in Git.

Required suites:

- exact policy code/phrase retrieval;
- semantic paraphrase retrieval;
- version/effective-date disambiguation;
- page/section citation fidelity;
- conflicting sources;
- no relevant source / insufficient evidence;
- prompt injection inside corpus and question;
- fabricated citation/quote rejection;
- extraction schema and deterministic gaps;
- stale report job;
- provider timeout, rate limit, malformed output, and retry;
- latency and token/cost budgets.

Define measurable thresholds before activation: retrieval recall@k, citation
precision, unsupported-claim rate, answer abstention behavior, p95 latency, and
cost per task. Human review owns acceptance.

The provider-neutral evaluation harness in `src/server/ai/policy-evaluation.ts`
now runs bounded cases sequentially and scores end-to-end answer status,
required-citation recall, allowed-citation precision, abstention, forbidden
prompt-injection output markers across every user-visible answer and limitation,
and p95 latency. Category labels are bound to their required outcomes so one
mislabeled case cannot claim retrieval, refusal, conflict, access, and provider
degradation coverage at once. Its retained scorecard contains only bounded
aliases, booleans, counts, rates, and timings—never questions, answers,
excerpts, or provider errors. Test coverage uses synthetic policy data. A
passing synthetic scorecard proves the harness behavior, not the real corpus or
pinned Production model; those still require a private custodian-approved suite
and owner review.

## Synchronous versus queued

Short bounded policy questions may run in a Vercel request only after measured
qualification and a clear timeout. Ingestion, OCR, embedding batches, bulk
exports, and large report jobs are durable jobs. They use Supabase Queues and,
if Vercel cannot safely execute them, the worker decision in ADR-0005.

## Cost controls

- Limit question and context sizes.
- Cache embeddings by content hash and model version, never by raw content in a
  public cache.
- Batch corpus embeddings and resume by chunk ID.
- Bound retries and concurrent provider requests.
- Record safe usage/cost metrics and alerts.
- Validate Supabase vector/database limits and OpenAI rate/data settings against
  the current plans before each environment.
- A free tier is an experiment budget, not an architecture guarantee.
