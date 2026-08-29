import "server-only";

import { z } from "zod";

import { getOpenAiDataControlsEnvironment } from "./openai-data-controls";

const openAiEmbeddingEnvironmentSchema = z.object({
  OPENAI_API_KEY: z.string().min(20),
  OPENAI_EMBEDDING_MODEL: z.string().trim().min(1).max(160),
  OPENAI_EMBEDDING_DIMENSIONS: z.coerce.number().int().min(1).max(16_000),
  POLICY_EMBEDDING_PROFILE_KEY: z
    .string()
    .trim()
    .regex(/^[a-z0-9][a-z0-9._-]{1,127}$/),
});

export type OpenAiEmbeddingEnvironment = z.infer<
  typeof openAiEmbeddingEnvironmentSchema
>;

/** Server-only configuration for the pinned policy query-embedding profile. */
export function getOpenAiEmbeddingEnvironment(
  environment: Record<string, string | undefined> = process.env,
): OpenAiEmbeddingEnvironment {
  getOpenAiDataControlsEnvironment(environment);
  return openAiEmbeddingEnvironmentSchema.parse({
    OPENAI_API_KEY: environment.OPENAI_API_KEY,
    OPENAI_EMBEDDING_MODEL: environment.OPENAI_EMBEDDING_MODEL,
    OPENAI_EMBEDDING_DIMENSIONS: environment.OPENAI_EMBEDDING_DIMENSIONS,
    POLICY_EMBEDDING_PROFILE_KEY: environment.POLICY_EMBEDDING_PROFILE_KEY,
  });
}
