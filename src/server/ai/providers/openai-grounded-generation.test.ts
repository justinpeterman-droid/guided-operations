import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { createOpenAiGroundedGenerationProvider } from "./openai-grounded-generation";

const citation = {
  documentId: "11111111-1111-4111-8111-111111111111",
  documentVersionId: "22222222-2222-4222-8222-222222222222",
  chunkId: "33333333-3333-4333-8333-333333333333",
  stableKey: "fictional-policy-101",
  title: "Fictional Training Policy 101",
  versionLabel: "training-v1",
  sourceSha256: "a".repeat(64),
  pageStart: 4,
  pageEnd: 5,
  sectionPath: "Fictional procedure",
  excerpt: "Fictional policy passage used only for an automated test.",
};

const environment = {
  OPENAI_API_KEY: "x".repeat(20),
  OPENAI_POLICY_MODEL: "fictional-model",
};
const budgetGuard = { reserve: vi.fn().mockResolvedValue(undefined) };

describe("OpenAI grounded generation provider", () => {
  it("uses a non-stored, tool-free strict structured response request", async () => {
    const fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          status: "completed",
          output_text: JSON.stringify({
            status: "answered",
            answer: "Fictional answer.",
            citations: [citation],
            limitations: [],
          }),
        }),
        { status: 200 },
      ),
    );
    const provider = createOpenAiGroundedGenerationProvider({
      fetch: fetch as typeof globalThis.fetch,
      environment,
      budgetGuard,
    });

    await expect(
      provider.generate({
        question: "What does the fictional policy say?",
        passages: [{ citation, relevanceScore: 0.9 }],
        maximumAnswerCharacters: 4000,
      }),
    ).resolves.toEqual({
      status: "answered",
      answer: "Fictional answer.",
      citations: [citation],
      limitations: [],
    });

    const [, request] = fetch.mock.calls[0] as [string, RequestInit];
    expect(request.method).toBe("POST");
    expect(request.headers).toMatchObject({
      Authorization: `Bearer ${environment.OPENAI_API_KEY}`,
    });
    expect(JSON.parse(request.body as string)).toMatchObject({
      model: environment.OPENAI_POLICY_MODEL,
      store: false,
      max_output_tokens: 2400,
      text: { format: { type: "json_schema", strict: true } },
    });
  });

  it("rejects provider failures without exposing their body", async () => {
    const provider = createOpenAiGroundedGenerationProvider({
      fetch: vi
        .fn()
        .mockResolvedValue(
          new Response("private provider detail", { status: 429 }),
        ),
      environment,
      budgetGuard,
    });

    await expect(
      provider.generate({
        question: "What does the fictional policy say?",
        passages: [{ citation, relevanceScore: 0.9 }],
        maximumAnswerCharacters: 4000,
      }),
    ).rejects.toThrow("OpenAI policy generation unavailable");
  });

  it("does not contact OpenAI when the shared budget denies the request", async () => {
    const fetch = vi.fn();
    const provider = createOpenAiGroundedGenerationProvider({
      fetch,
      environment,
      budgetGuard: {
        reserve: vi.fn().mockRejectedValue(new Error("circuit open")),
      },
    });

    await expect(
      provider.generate({
        question: "What does the fictional policy say?",
        passages: [{ citation, relevanceScore: 0.9 }],
        maximumAnswerCharacters: 4000,
      }),
    ).rejects.toThrow("circuit open");
    expect(fetch).not.toHaveBeenCalled();
  });
});
