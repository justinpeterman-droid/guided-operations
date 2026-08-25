# ADR-0004: Provider-Neutral AI and PostgreSQL RAG

- **Status:** Accepted
- **Date:** 2026-08-25
- **Deciders:** Product owner and technical lead

## Context

The old system coupled retrieval and generation to Google Vertex AI, Discovery
Engine/Agent Builder, and GCS. The replacement prohibits Google hosting, allows
OpenAI, needs source/page citations, and should remain portable. The real
policy/reference corpus is the only real content currently approved.

## Decision

- Define provider-neutral embedding and structured-generation interfaces.
- Use OpenAI as the initial server/worker adapter.
- Store original corpus versions in private Supabase Storage.
- Store page/chunk/provenance metadata in PostgreSQL.
- Implement hybrid full-text plus pgvector retrieval with versioned ranking.
- Require structured citation IDs and deterministic post-validation.
- Preserve extraction -> deterministic gaps/validation -> reviewed
  structured-facts generation.
- Keep corpus ingestion/embedding and long report work durable and idempotent.

No model/provider SDK appears in domain or API types.

## Options considered

### Option A: Provider-neutral adapters plus PostgreSQL hybrid retrieval

| Dimension          | Assessment |
| ------------------ | ---------- |
| Portability        | High       |
| Initial complexity | Medium     |
| Citation control   | High       |
| Cost transparency  | High       |
| Fit with Supabase  | Strong     |

Pros:

- One database owns source/version/chunk/citation metadata.
- OpenAI can be replaced without rewriting the domain contract.
- Full-text and vector behavior is testable/versioned.
- No separate vector database is required at current scale.

Cons:

- We own ingestion, ranking, evaluation, and citation validation.
- Vector indexes and embedding migrations require deliberate operations.

### Option B: OpenAI-specific domain and hosted retrieval

| Dimension                | Assessment         |
| ------------------------ | ------------------ |
| Time to prototype        | Fast               |
| Portability              | Low                |
| Citation/version control | Provider-dependent |
| Operational burden       | Low initially      |

Pros:

- Less initial retrieval code.
- Provider tooling may accelerate a prototype.

Cons:

- Repeats prior provider coupling.
- Harder to guarantee stable source/version/page citations and exports.
- Migration and cost behavior depend on a provider-specific store.

### Option C: Separate vector/search service

| Dimension         | Assessment |
| ----------------- | ---------- |
| Scale ceiling     | High       |
| Complexity/cost   | High       |
| Current necessity | Low        |

Pros:

- Specialized retrieval features and scaling.

Cons:

- Additional credentials, provider, synchronization, and failure modes.
- Source-of-truth/citation reconciliation becomes harder.

### Option D: No AI/RAG

Safest and cheapest, but does not satisfy the policy expert/report-assistance
requirements. Manual workflows must nevertheless continue when AI is down.

## Trade-off analysis

PostgreSQL hybrid retrieval is sufficient for the expected single-facility
corpus and gives the product direct control over citations and versions. The
adapter boundary costs some up-front design but prevents another infrastructure
rewrite when models/providers change.

## Consequences

- Corpus export/reconciliation is a prerequisite to Google decommissioning.
- Original bytes, pages, chunks, embeddings, configs, and active versions are
  separately versioned.
- Model/embedding changes require evaluation and controlled activation.
- Real corpus content requires reviewed OpenAI data handling/retention settings.
- Prompt injection and insufficient-evidence tests are release gates.
- AI failure never blocks manual record editing or changes reviewed state.
- Usage, latency, and cost are recorded without prompt/answer content.

## Action items

1. [ ] Inventory/export/reconcile the authoritative corpus and rights.
2. [ ] Define provider interfaces and structured schemas.
3. [ ] Build deterministic page-aware ingest/chunk/version pipeline.
4. [ ] Benchmark FTS/vector indexes and ranking on the actual corpus.
5. [ ] Create citation and no-fabrication evaluation gates.
6. [ ] Review current OpenAI privacy/retention/region/rate settings before real
       corpus use.
