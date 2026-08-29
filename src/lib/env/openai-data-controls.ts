import "server-only";

import { z } from "zod";

const approvedRetentionModes = [
  "zero_data_retention",
  "modified_abuse_monitoring",
  "enhanced_zero_data_retention",
  "enhanced_modified_abuse_monitoring",
] as const;

const attestedSchema = z.object({
  OPENAI_DATA_CONTROLS_APPROVAL_REF: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9][A-Za-z0-9._:/-]{1,159}$/),
  OPENAI_DATA_RETENTION_MODE: z.enum(approvedRetentionModes),
  OPENAI_API_DATA_SHARING_ENABLED: z
    .literal("false")
    .transform(() => false as const),
});

/**
 * The fictional-corpus exemption. A provider retention agreement exists to
 * protect restricted source text. A generated fictional corpus contains none,
 * so there is nothing for the attestation to protect and it is not required.
 *
 * This is deliberately narrow. It is selected only by the exact literal
 * `fictional`, it still forbids API data sharing, and it grants nothing else.
 * Any other value - absent, misspelled, or `restricted` - falls through to the
 * full attestation, so the default remains fail-closed.
 *
 * Setting this while a real corpus is loaded would be a false declaration. The
 * operator, not this module, is accountable for that statement.
 */
const fictionalSchema = z.object({
  POLICY_CORPUS_CLASSIFICATION: z.literal("fictional"),
  OPENAI_API_DATA_SHARING_ENABLED: z
    .literal("false")
    .transform(() => false as const),
});

export type OpenAiDataControlsEnvironment =
  z.infer<typeof attestedSchema> | z.infer<typeof fictionalSchema>;

/**
 * Fail-closed operator attestation for the OpenAI project used by this app.
 * The approval reference is metadata only; it must never contain a credential.
 */
export function getOpenAiDataControlsEnvironment(
  environment: Record<string, string | undefined> = process.env,
): OpenAiDataControlsEnvironment {
  if (environment.POLICY_CORPUS_CLASSIFICATION === "fictional") {
    return fictionalSchema.parse({
      POLICY_CORPUS_CLASSIFICATION: environment.POLICY_CORPUS_CLASSIFICATION,
      OPENAI_API_DATA_SHARING_ENABLED:
        environment.OPENAI_API_DATA_SHARING_ENABLED,
    });
  }

  return attestedSchema.parse({
    OPENAI_DATA_CONTROLS_APPROVAL_REF:
      environment.OPENAI_DATA_CONTROLS_APPROVAL_REF,
    OPENAI_DATA_RETENTION_MODE: environment.OPENAI_DATA_RETENTION_MODE,
    OPENAI_API_DATA_SHARING_ENABLED:
      environment.OPENAI_API_DATA_SHARING_ENABLED,
  });
}
