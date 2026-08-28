import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { createSupabasePolicyRetrievalProvider } from "./supabase-policy-retrieval";

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
  relevance_score: 0.9,
};

describe("Supabase policy retrieval provider", () => {
  it("maps only narrow citation evidence from the reviewed RPC", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [row], error: null });
    const provider = createSupabasePolicyRetrievalProvider({ rpc });

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
    expect(rpc).toHaveBeenCalledWith("retrieve_policy_passages_v3", {
      p_question: "What does the fictional procedure require?",
      p_limit: 8,
    });
  });

  it("passes an explicit approved-version filter to the authorized RPC", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [row], error: null });
    const provider = createSupabasePolicyRetrievalProvider({ rpc });

    await expect(
      provider.retrieve({
        facilityId: "44444444-4444-4444-8444-444444444444",
        question: "Fictional policy question",
        maximumPassages: 8,
        approvedDocumentVersionIds: ["22222222-2222-4222-8222-222222222222"],
      }),
    ).resolves.toHaveLength(1);
    expect(rpc).toHaveBeenCalledWith("retrieve_policy_passages_v3", {
      p_question: "Fictional policy question",
      p_limit: 8,
      p_approved_document_version_ids: ["22222222-2222-4222-8222-222222222222"],
    });
  });

  it("passes exact collection filters to the authorized RPC", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [row], error: null });
    const provider = createSupabasePolicyRetrievalProvider({ rpc });

    await expect(
      provider.retrieve({
        facilityId: "44444444-4444-4444-8444-444444444444",
        question: "Fictional policy question",
        maximumPassages: 8,
        collections: ["BMU policies", "SD"],
      }),
    ).resolves.toHaveLength(1);
    expect(rpc).toHaveBeenCalledWith("retrieve_policy_passages_v3", {
      p_question: "Fictional policy question",
      p_limit: 8,
      p_collections: ["BMU policies", "SD"],
    });
  });

  it("does not treat malformed or failed RPC output as policy evidence", async () => {
    const provider = createSupabasePolicyRetrievalProvider({
      rpc: vi
        .fn()
        .mockResolvedValue({ data: [{ ...row, excerpt: "" }], error: null }),
    });

    await expect(
      provider.retrieve({
        facilityId: "44444444-4444-4444-8444-444444444444",
        question: "Fictional policy question",
        maximumPassages: 8,
      }),
    ).resolves.toEqual([]);
  });
});
