import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import type { AiRequestBudgetGuard } from "../ai-request-budget";
import { createOpenAiPolicyQueryEmbeddingProvider } from "./openai-query-embedding";

const environment = {
  OPENAI_API_KEY: "x".repeat(20),
  OPENAI_EMBEDDING_MODEL: "fictional-embedding-model",
  OPENAI_EMBEDDING_DIMENSIONS: "3",
  POLICY_EMBEDDING_PROFILE_KEY: "fictional.openai-embedding-v1",
  OPENAI_DATA_CONTROLS_APPROVAL_REF: "fictional-owner-approval",
  OPENAI_DATA_RETENTION_MODE: "zero_data_retention",
  OPENAI_API_DATA_SHARING_ENABLED: "false",
};

function budgetGuard() {
  const release = vi.fn(async () => undefined);
  const reserve = vi.fn(async () => ({
    providerTimeoutMs: 5_000,
    release,
  }));
  return {
    guard: { reserve } satisfies AiRequestBudgetGuard,
    reserve,
    release,
  };
}

describe("OpenAI policy query embedding provider", () => {
  it("sends one bounded request and returns the pinned profile", async () => {
    const budget = budgetGuard();
    const fetchImplementation = vi.fn(async () =>
      Response.json({
        object: "list",
        model: "fictional-embedding-model",
        data: [{ object: "embedding", index: 0, embedding: [0.1, 0.2, 0.3] }],
        usage: { prompt_tokens: 4, total_tokens: 4 },
      }),
    );
    const provider = createOpenAiPolicyQueryEmbeddingProvider({
      environment,
      fetch: fetchImplementation,
      budgetGuard: budget.guard,
    });

    await expect(
      provider.embedQuestion(" fictional procedure "),
    ).resolves.toEqual({
      profileKey: "fictional.openai-embedding-v1",
      dimensions: 3,
      values: [0.1, 0.2, 0.3],
    });

    expect(budget.reserve).toHaveBeenCalledWith("policy_answer");
    expect(budget.release).toHaveBeenCalledOnce();
    expect(fetchImplementation).toHaveBeenCalledWith(
      "https://api.openai.com/v1/embeddings",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: `Bearer ${environment.OPENAI_API_KEY}`,
        }),
        body: JSON.stringify({
          model: "fictional-embedding-model",
          input: "fictional procedure",
          encoding_format: "float",
          dimensions: 3,
        }),
      }),
    );
  });

  it("fails closed when the provider returns the wrong model or dimension", async () => {
    const budget = budgetGuard();
    const provider = createOpenAiPolicyQueryEmbeddingProvider({
      environment,
      budgetGuard: budget.guard,
      fetch: vi.fn(async () =>
        Response.json({
          object: "list",
          model: "unexpected-model",
          data: [{ object: "embedding", index: 0, embedding: [0.1, 0.2] }],
        }),
      ),
    });

    await expect(
      provider.embedQuestion("fictional procedure"),
    ).rejects.toThrow();
    expect(budget.release).toHaveBeenCalledOnce();
  });

  it("fails closed on a zero vector and still releases its lease", async () => {
    const budget = budgetGuard();
    const provider = createOpenAiPolicyQueryEmbeddingProvider({
      environment,
      budgetGuard: budget.guard,
      fetch: vi.fn(async () =>
        Response.json({
          object: "list",
          model: "fictional-embedding-model",
          data: [{ object: "embedding", index: 0, embedding: [0, 0, 0] }],
        }),
      ),
    });

    await expect(
      provider.embedQuestion("fictional procedure"),
    ).rejects.toThrow();
    expect(budget.release).toHaveBeenCalledOnce();
  });
});
