import "server-only";

import { z } from "zod";

const incidentServerEnvironmentSchema = z.object({
  INCIDENT_IDEMPOTENCY_HMAC_KEY: z.string().min(32),
});

export type IncidentServerEnvironment = z.infer<
  typeof incidentServerEnvironmentSchema
>;

/**
 * Dedicated secret material for incident command idempotency fingerprints.
 * It must not share the CSRF key or appear in browser-visible configuration.
 */
export function getIncidentServerEnvironment(
  environment: Record<string, string | undefined> = process.env,
): IncidentServerEnvironment {
  return incidentServerEnvironmentSchema.parse({
    INCIDENT_IDEMPOTENCY_HMAC_KEY: environment.INCIDENT_IDEMPOTENCY_HMAC_KEY,
  });
}
