import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import type { PolicyQueryEmbeddingProvider } from "./contracts";
import {
  createSupabasePolicyRetrievalProvider,
  PolicyRetrievalUnavailableError,
} from "./supabase-policy-retrieval";

const row = {
  document_id: "11111111-1111-4111-8111-111111111111",
  document_version_id: "22222222-2222-4222-8222-222222222222",
  chunk_id: "33333333-3333-4333-8333-333333333333",
  stable_key: "fictional-policy-101",
  title: "Fictional Training Policy 101",
  version_label: "training-v1",
  source_sha256: "a".repeat(64),
  collection: "BMU policies" as const,
  page_start: 4,
  page_end: 5,
  section_path: "Fictional procedure",
  excerpt: "Fictional policy passage used only for an automated test.",
  relevance_score: 0.032,
  lexical_rank: 1,
  semantic_rank: 2,
};

function embeddingProvider(
  overrides: Partial<
    Awaited<ReturnType<PolicyQueryEmbeddingProvider["embedQuestion"]>>
  > = {},
) {
  return {
    providerKey: "fictional-embedding",
    embedQuestion: vi.fn(async () => ({
      profileKey: "fictional.openai-embedding-v1",
      dimensions: 3,
      values: [0.1, 0.2, 0.3],
      ...overrides,
    })),
  } satisfies PolicyQueryEmbeddingProvider;
}

describe("Supabase hybrid policy retrieval provider", () => {
  it("maps only narrow citation evidence from the reviewed hybrid RPC", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [row], error: null });
    const embedding = embeddingProvider();
    const provider = createSupabasePolicyRetrievalProvider({ rpc }, embedding);

    await expect(
      provider.retrieve({
        facilityId: "44444444-4444-4444-8444-444444444444",
        question: "What does the fictional procedure require?",
        maximumPassages: 8,
      }),
    ).resolves.toEqual([
      {
        citation: {
          documentId: row.document_id,
          documentVersionId: row.document_version_id,
          chunkId: row.chunk_id,
          stableKey: row.stable_key,
          title: row.title,
          versionLabel: row.version_label,
          sourceSha256: row.source_sha256,
          collection: row.collection,
          pageStart: row.page_start,
          pageEnd: row.page_end,
          sectionPath: row.section_path,
          excerpt: row.excerpt,
        },
        relevanceScore: row.relevance_score,
      },
    ]);
    expect(embedding.embedQuestion).toHaveBeenCalledWith(
      "What does the fictional procedure require?",
    );
    expect(rpc).toHaveBeenCalledWith("retrieve_policy_passages_v4", {
      p_question: "What does the fictional procedure require?",
      p_query_embedding: "[0.1,0.2,0.3]",
      p_embedding_profile_key: "fictional.openai-embedding-v1",
      p_limit: 8,
    });
  });

  it("passes explicit approved-version and collection filters", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [row], error: null });
    const provider = createSupabasePolicyRetrievalProvider(
      { rpc },
      embeddingProvider(),
    );

    await expect(
      provider.retrieve({
        facilityId: "44444444-4444-4444-8444-444444444444",
        question: "Fictional policy question",
        maximumPassages: 8,
        approvedDocumentVersionIds: ["22222222-2222-4222-8222-222222222222"],
        collections: ["BMU policies", "SD"],
      }),
    ).resolves.toHaveLength(1);
    expect(rpc).toHaveBeenCalledWith("retrieve_policy_passages_v4", {
      p_question: "Fictional policy question",
      p_query_embedding: "[0.1,0.2,0.3]",
      p_embedding_profile_key: "fictional.openai-embedding-v1",
      p_limit: 8,
      p_approved_document_version_ids: ["22222222-2222-4222-8222-222222222222"],
      p_collections: ["BMU policies", "SD"],
    });
  });

  it("rejects empty filters instead of widening them", async () => {
    const rpc = vi.fn();
    const provider = createSupabasePolicyRetrievalProvider(
      { rpc },
      embeddingProvider(),
    );

    await expect(
      provider.retrieve({
        facilityId: "44444444-4444-4444-8444-444444444444",
        question: "Fictional policy question",
        maximumPassages: 8,
        collections: [],
      }),
    ).rejects.toBeInstanceOf(PolicyRetrievalUnavailableError);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("does not treat malformed or failed provider output as policy evidence", async () => {
    const malformedRowProvider = createSupabasePolicyRetrievalProvider(
      {
        rpc: vi
          .fn()
          .mockResolvedValue({ data: [{ ...row, excerpt: "" }], error: null }),
      },
      embeddingProvider(),
    );

    await expect(
      malformedRowProvider.retrieve({
        facilityId: "44444444-4444-4444-8444-444444444444",
        question: "Fictional policy question",
        maximumPassages: 8,
      }),
    ).rejects.toBeInstanceOf(PolicyRetrievalUnavailableError);

    const malformedEmbeddingProvider = createSupabasePolicyRetrievalProvider(
      { rpc: vi.fn() },
      embeddingProvider({ values: [0.1, 0.2] }),
    );
    await expect(
      malformedEmbeddingProvider.retrieve({
        facilityId: "44444444-4444-4444-8444-444444444444",
        question: "Fictional policy question",
        maximumPassages: 8,
      }),
    ).rejects.toBeInstanceOf(PolicyRetrievalUnavailableError);
  });
});
