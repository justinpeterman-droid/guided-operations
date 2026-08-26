import "server-only";

import { z } from "zod";

const observabilityEnvironmentSchema = z.object({
  SAFE_OPERATIONAL_LOGGING_ENABLED: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
});

export type ObservabilityEnvironment = z.infer<
  typeof observabilityEnvironmentSchema
>;

/** Fail-closed control for allowlisted operational events. */
export function getObservabilityEnvironment(
  environment: Record<string, string | undefined> = process.env,
): ObservabilityEnvironment {
  return observabilityEnvironmentSchema.parse({
    SAFE_OPERATIONAL_LOGGING_ENABLED:
      environment.SAFE_OPERATIONAL_LOGGING_ENABLED,
  });
}
