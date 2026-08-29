import "server-only";

import { z } from "zod";

import { getOpenAiDataControlsEnvironment } from "./openai-data-controls";

const openAiPolicyEnvironmentSchema = z.object({
  OPENAI_API_KEY: z.string().min(20),
  OPENAI_POLICY_MODEL: z.string().trim().min(1).max(160),
});

export type OpenAiPolicyEnvironment = z.infer<
  typeof openAiPolicyEnvironmentSchema
>;

/** Server-only model configuration for grounded policy answers. */
export function getOpenAiPolicyEnvironment(
  environment: Record<string, string | undefined> = process.env,
): OpenAiPolicyEnvironment {
  getOpenAiDataControlsEnvironment(environment);
  return openAiPolicyEnvironmentSchema.parse({
    OPENAI_API_KEY: environment.OPENAI_API_KEY,
    OPENAI_POLICY_MODEL: environment.OPENAI_POLICY_MODEL,
  });
}
