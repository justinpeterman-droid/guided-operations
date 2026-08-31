import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  createOpenAiStructuredResponseRequest,
  OPENAI_RESPONSES_CONTRACT_VERSION,
} from "./openai-responses-contract";

const schema = {
  type: "object",
  additionalProperties: false,
  required: ["answer"],
  properties: { answer: { type: "string" } },
} as const;

describe("OpenAI Responses request contract", () => {
  it("builds the exact non-streaming, non-stored, tool-free request shape", () => {
    const request = createOpenAiStructuredResponseRequest({
      model: "fictional-model",
      instructions: "Use only fictional supplied evidence.",
      input: '{"question":"fictional"}',
      reasoningEffort: "medium",
      maximumOutputTokens: 4_000,
      schemaName: "fictional_answer",
      schema,
    });

    expect(OPENAI_RESPONSES_CONTRACT_VERSION).toBe("openai-node@7.8.0");
    expect(Object.keys(request).sort()).toEqual(
      [
        "input",
        "instructions",
        "max_output_tokens",
        "model",
        "reasoning",
        "store",
        "text",
      ].sort(),
    );
    expect(request).toEqual({
      model: "fictional-model",
      store: false,
      instructions: "Use only fictional supplied evidence.",
      input: '{"question":"fictional"}',
      reasoning: { effort: "medium" },
      max_output_tokens: 4_000,
      text: {
        format: {
          type: "json_schema",
          name: "fictional_answer",
          strict: true,
          schema,
        },
      },
    });
    expect(request).not.toHaveProperty("tools");
    expect(request).not.toHaveProperty("stream");
  });

  it.each([
    ["missing model", { model: "" }],
    ["missing instructions", { instructions: "" }],
    ["missing input", { input: "" }],
    ["missing schema name", { schemaName: "" }],
    ["invalid output token limit", { maximumOutputTokens: 0 }],
  ])("rejects %s before a provider request is serialized", (_, override) => {
    expect(() =>
      createOpenAiStructuredResponseRequest({
        model: "fictional-model",
        instructions: "Use only fictional supplied evidence.",
        input: '{"question":"fictional"}',
        reasoningEffort: "low",
        maximumOutputTokens: 1_000,
        schemaName: "fictional_answer",
        schema,
        ...override,
      }),
    ).toThrow();
  });
});
