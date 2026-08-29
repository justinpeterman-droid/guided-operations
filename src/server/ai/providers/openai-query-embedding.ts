import "server-only";

import { z } from "zod";

import { getOpenAiEmbeddingEnvironment } from "@/lib/env/openai-embedding";

import {
  createAiRequestBudgetGuard,
  type AiRequestBudgetGuard,
} from "../ai-request-budget";
import type { PolicyQueryEmbeddingProvider } from "../contracts";

const questionSchema = z.string().trim().min(3).max(2_000);

const responseSchema = z
  .object({
    object: z.literal("list"),
    model: z.string().min(1).max(160),
    data: z
      .array(
        z
          .object({
            object: z.literal("embedding"),
            index: z.literal(0),
            embedding: z.array(z.number().finite()).min(1).max(16_000),
          })
          .strict(),
      )
      .length(1),
  })
  .passthrough();

export type OpenAiEmbeddingFetch = typeof fetch;

/**
 * Creates one bounded query embedding. The raw question and returned vector are
 * transient and are never logged or persisted by this adapter.
 */
export function createOpenAiPolicyQueryEmbeddingProvider(
  options: Readonly<{
    fetch?: OpenAiEmbeddingFetch;
    environment?: Record<string, string | undefined>;
    budgetGuard?: AiRequestBudgetGuard;
    accountId?: string;
  }> = {},
): PolicyQueryEmbeddingProvider {
  const fetchImplementation = options.fetch ?? fetch;
  const budgetGuard =
    options.budgetGuard ?? createAiRequestBudgetGuard(options.accountId ?? "");

  return {
    providerKey: "openai-query-embedding-v1",
    async embedQuestion(rawQuestion) {
      const question = questionSchema.parse(rawQuestion);
      const lease = await budgetGuard.reserve("policy_answer");
      try {
        const environment = getOpenAiEmbeddingEnvironment(options.environment);
        const response = await fetchImplementation(
          "https://api.openai.com/v1/embeddings",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${environment.OPENAI_API_KEY}`,
              "Content-Type": "application/json",
            },
            signal: AbortSignal.timeout(lease.providerTimeoutMs),
            body: JSON.stringify({
              model: environment.OPENAI_EMBEDDING_MODEL,
              input: question,
              encoding_format: "float",
              dimensions: environment.OPENAI_EMBEDDING_DIMENSIONS,
            }),
          },
        );

        if (!response.ok) throw new Error("OpenAI query embedding unavailable");

        const parsed = responseSchema.parse(await response.json());
        const values = parsed.data[0].embedding;
        if (
          parsed.model !== environment.OPENAI_EMBEDDING_MODEL ||
          values.length !== environment.OPENAI_EMBEDDING_DIMENSIONS ||
          values.every((value) => value === 0)
        ) {
          throw new Error("OpenAI query embedding did not match its profile");
        }

        return {
          profileKey: environment.POLICY_EMBEDDING_PROFILE_KEY,
          dimensions: environment.OPENAI_EMBEDDING_DIMENSIONS,
          values,
        };
      } finally {
        await lease.release();
      }
    },
  };
}
