import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { getOpenAiPolicyEnvironment } from "./openai-policy";

describe("OpenAI policy environment", () => {
  it("requires a server-only key and an explicitly pinned policy model", () => {
    expect(
      getOpenAiPolicyEnvironment({
        OPENAI_API_KEY: "x".repeat(20),
        OPENAI_POLICY_MODEL: "test-model",
      }),
    ).toEqual({
      OPENAI_API_KEY: "x".repeat(20),
      OPENAI_POLICY_MODEL: "test-model",
    });
  });

  it("rejects an implicit model selection", () => {
    expect(() =>
      getOpenAiPolicyEnvironment({ OPENAI_API_KEY: "x".repeat(20) }),
    ).toThrow();
  });
});
