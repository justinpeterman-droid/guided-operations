import "server-only";

/**
 * Narrow non-streaming Responses request contract extracted from OpenAI's
 * OpenAPI-generated `ResponseCreateParamsBase` in openai-node v7.8.0.
 *
 * The application intentionally keeps provider types inside this adapter layer
 * and retains its injected `fetch` seam. Updating the OpenAI request contract
 * therefore requires one reviewed file instead of three free-form JSON bodies.
 * Source: openai/openai-node v7.8.0, generated responses.ts.
 */
export const OPENAI_RESPONSES_CONTRACT_VERSION = "openai-node@7.8.0";

export type OpenAiReasoningEffort =
  | "minimal"
  | "low"
  | "medium"
  | "high";

export type OpenAiJsonSchema = Readonly<Record<string, unknown>>;

export interface OpenAiResponsesCreateParamsNonStreaming {
  readonly model: string;
  readonly store: false;
  readonly instructions: string;
  readonly input: string;
  readonly reasoning: Readonly<{ effort: OpenAiReasoningEffort }>;
  readonly max_output_tokens: number;
  readonly text: Readonly<{
    format: Readonly<{
      type: "json_schema";
      name: string;
      strict: true;
      schema: OpenAiJsonSchema;
    }>;
  }>;
  readonly stream?: false;
  readonly tools?: never;
}

export interface OpenAiStructuredResponseRequestInput {
  readonly model: string;
  readonly instructions: string;
  readonly input: string;
  readonly reasoningEffort: OpenAiReasoningEffort;
  readonly maximumOutputTokens: number;
  readonly schemaName: string;
  readonly schema: OpenAiJsonSchema;
}

/**
 * Creates the complete tool-free, non-stored request accepted by all three
 * Responses adapters. The `satisfies` check intentionally fails compilation
 * when the generated field names or nested shapes drift.
 */
export function createOpenAiStructuredResponseRequest(
  input: OpenAiStructuredResponseRequestInput,
): OpenAiResponsesCreateParamsNonStreaming {
  if (!input.model.trim()) throw new Error("OpenAI model is required");
  if (!input.instructions.trim())
    throw new Error("OpenAI instructions are required");
  if (!input.input.trim()) throw new Error("OpenAI input is required");
  if (!input.schemaName.trim())
    throw new Error("OpenAI schema name is required");
  if (
    !Number.isSafeInteger(input.maximumOutputTokens) ||
    input.maximumOutputTokens < 1
  ) {
    throw new Error("OpenAI output token limit must be a positive integer");
  }

  const request = {
    model: input.model,
    store: false,
    instructions: input.instructions,
    input: input.input,
    reasoning: { effort: input.reasoningEffort },
    max_output_tokens: input.maximumOutputTokens,
    text: {
      format: {
        type: "json_schema",
        name: input.schemaName,
        strict: true,
        schema: input.schema,
      },
    },
  } satisfies OpenAiResponsesCreateParamsNonStreaming;

  return request;
}
