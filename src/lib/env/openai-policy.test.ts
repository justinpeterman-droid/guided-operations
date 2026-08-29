import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { getOpenAiPolicyEnvironment } from "./openai-policy";

describe("OpenAI policy environment", () => {
  it("requires a server-only key and an explicitly pinned policy model", () => {
    expect(
      getOpenAiPolicyEnvironment({
        OPENAI_API_KEY: "x".repeat(20),
        OPENAI_POLICY_MODEL: "test-model",
        OPENAI_DATA_CONTROLS_APPROVAL_REF: "fictional-owner-approval",
        OPENAI_DATA_RETENTION_MODE: "zero_data_retention",
        OPENAI_API_DATA_SHARING_ENABLED: "false",
      }),
    ).toEqual({
      OPENAI_API_KEY: "x".repeat(20),
      OPENAI_POLICY_MODEL: "test-model",
    });
  });

  it("rejects an implicit model selection", () => {
    expect(() =>
      getOpenAiPolicyEnvironment({
        OPENAI_API_KEY: "x".repeat(20),
        OPENAI_DATA_CONTROLS_APPROVAL_REF: "fictional-owner-approval",
        OPENAI_DATA_RETENTION_MODE: "zero_data_retention",
        OPENAI_API_DATA_SHARING_ENABLED: "false",
      }),
    ).toThrow();
  });

  it("rejects provider use without approved data controls", () => {
    expect(() =>
      getOpenAiPolicyEnvironment({
        OPENAI_API_KEY: "x".repeat(20),
        OPENAI_POLICY_MODEL: "test-model",
      }),
    ).toThrow();
  });
});
