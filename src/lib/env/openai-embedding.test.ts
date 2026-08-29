import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { getOpenAiEmbeddingEnvironment } from "./openai-embedding";

const validEnvironment = {
  OPENAI_API_KEY: "x".repeat(20),
  OPENAI_EMBEDDING_MODEL: "fictional-embedding-model",
  OPENAI_EMBEDDING_DIMENSIONS: "3",
  POLICY_EMBEDDING_PROFILE_KEY: "fictional.openai-embedding-v1",
  OPENAI_DATA_CONTROLS_APPROVAL_REF: "fictional-owner-approval",
  OPENAI_DATA_RETENTION_MODE: "zero_data_retention",
  OPENAI_API_DATA_SHARING_ENABLED: "false",
};

describe("OpenAI embedding environment", () => {
  it("accepts a pinned bounded embedding profile", () => {
    expect(getOpenAiEmbeddingEnvironment(validEnvironment)).toEqual({
      OPENAI_API_KEY: validEnvironment.OPENAI_API_KEY,
      OPENAI_EMBEDDING_MODEL: validEnvironment.OPENAI_EMBEDDING_MODEL,
      OPENAI_EMBEDDING_DIMENSIONS: 3,
      POLICY_EMBEDDING_PROFILE_KEY:
        validEnvironment.POLICY_EMBEDDING_PROFILE_KEY,
    });
  });

  it("rejects a missing profile key", () => {
    expect(() =>
      getOpenAiEmbeddingEnvironment({
        ...validEnvironment,
        POLICY_EMBEDDING_PROFILE_KEY: undefined,
      }),
    ).toThrow();
  });

  it("rejects an invalid or unbounded dimension", () => {
    expect(() =>
      getOpenAiEmbeddingEnvironment({
        ...validEnvironment,
        OPENAI_EMBEDDING_DIMENSIONS: "0",
      }),
    ).toThrow();
    expect(() =>
      getOpenAiEmbeddingEnvironment({
        ...validEnvironment,
        OPENAI_EMBEDDING_DIMENSIONS: "16001",
      }),
    ).toThrow();
  });
});
