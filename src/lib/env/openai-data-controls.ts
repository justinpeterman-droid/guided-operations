import "server-only";

import { z } from "zod";

const approvedRetentionModes = [
  "zero_data_retention",
  "modified_abuse_monitoring",
  "enhanced_zero_data_retention",
  "enhanced_modified_abuse_monitoring",
] as const;

const schema = z.object({
  OPENAI_DATA_CONTROLS_APPROVAL_REF: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9][A-Za-z0-9._:/-]{1,159}$/),
  OPENAI_DATA_RETENTION_MODE: z.enum(approvedRetentionModes),
  OPENAI_API_DATA_SHARING_ENABLED: z
    .literal("false")
    .transform(() => false as const),
});

export type OpenAiDataControlsEnvironment = z.infer<typeof schema>;

/**
 * Fail-closed operator attestation for the OpenAI project used by this app.
 * The approval reference is metadata only; it must never contain a credential.
 */
export function getOpenAiDataControlsEnvironment(
  environment: Record<string, string | undefined> = process.env,
): OpenAiDataControlsEnvironment {
  return schema.parse({
    OPENAI_DATA_CONTROLS_APPROVAL_REF:
      environment.OPENAI_DATA_CONTROLS_APPROVAL_REF,
    OPENAI_DATA_RETENTION_MODE: environment.OPENAI_DATA_RETENTION_MODE,
    OPENAI_API_DATA_SHARING_ENABLED:
      environment.OPENAI_API_DATA_SHARING_ENABLED,
  });
}
