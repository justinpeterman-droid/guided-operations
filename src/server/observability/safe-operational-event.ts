import "server-only";

import { z } from "zod";

import { getObservabilityEnvironment } from "@/lib/env/observability";

const safeIdentifierSchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,159}$/);

const safeOperationalEventInputSchema = z
  .object({
    event_name: z.enum([
      "auth.passcode_change",
      "auth.sign_in",
      "auth.sign_out",
      "auth.sign_out_all",
      "auth.temporary_passcode_change",
      "daily_paperwork_package.request",
      "incident_fact_extraction.request",
      "policy_answer.request",
      "policy_source.read",
      "report_draft.request",
    ]),
    outcome: z.enum([
      "answered",
      "authentication_required",
      "changed",
      "conflict",
      "insufficient_evidence",
      "integrity_failed",
      "invalid_suggestion",
      "not_found",
      "provider_unavailable",
      "request_not_allowed",
      "reviewed",
      "service_unavailable",
      "sign_in_failed",
      "signed_in",
      "served",
      "signed_out",
      "signed_out_everywhere",
      "storage_unavailable",
      "stored",
      "suggested",
      "validation_rejected",
    ]),
    reason_code: z
      .enum([
        "budget_check_failed",
        "budget_exhausted",
        "generation_failed",
        "generation_disabled",
        "invalid_output",
        "invalid_source",
        "persistence_failed",
        "retrieval_failed",
        "unhandled_failure",
      ])
      .optional(),
    request_id: z.uuid(),
    status_code: z.number().int().min(100).max(599),
    duration_ms: z.number().int().nonnegative().max(3_600_000),
    citation_count: z.number().int().nonnegative().max(12).optional(),
    environment: z.enum(["development", "preview", "production", "test"]),
    corpus_version: safeIdentifierSchema.optional(),
  })
  .strict();

const deploymentContextSchema = z.object({
  VERCEL_DEPLOYMENT_ID: safeIdentifierSchema.optional(),
  VERCEL_GIT_COMMIT_SHA: z
    .string()
    .trim()
    .regex(/^[a-f0-9]{40}$/)
    .optional(),
});

const safeOperationalEventSchema = safeOperationalEventInputSchema
  .extend({
    timestamp: z.iso.datetime({ offset: true }),
    deployment_id: safeIdentifierSchema.optional(),
    commit_sha: z
      .string()
      .regex(/^[a-f0-9]{40}$/)
      .optional(),
  })
  .strict();

export type SafeOperationalEventInput = z.input<
  typeof safeOperationalEventInputSchema
>;
export type SafeOperationalEvent = z.output<typeof safeOperationalEventSchema>;

type SafeOperationalEventOptions = Readonly<{
  environment?: Record<string, string | undefined>;
  now?: () => Date;
  sink?: (serializedEvent: string) => void;
}>;

/**
 * Builds the exact value-free event shape. Strict parsing prevents callers
 * from attaching prompts, responses, identifiers, or arbitrary error text.
 */
export function buildSafeOperationalEvent(
  input: SafeOperationalEventInput,
  options: SafeOperationalEventOptions = {},
): SafeOperationalEvent {
  const environment = options.environment ?? process.env;
  const deployment = deploymentContextSchema.parse({
    VERCEL_DEPLOYMENT_ID: environment.VERCEL_DEPLOYMENT_ID,
    VERCEL_GIT_COMMIT_SHA: environment.VERCEL_GIT_COMMIT_SHA,
  });

  return safeOperationalEventSchema.parse({
    ...safeOperationalEventInputSchema.parse(input),
    timestamp: (options.now ?? (() => new Date()))().toISOString(),
    deployment_id: deployment.VERCEL_DEPLOYMENT_ID,
    commit_sha: deployment.VERCEL_GIT_COMMIT_SHA,
  });
}

/** Writes one allowlisted JSON event only when the fail-closed gate is on. */
export function writeSafeOperationalEvent(
  input: SafeOperationalEventInput,
  options: SafeOperationalEventOptions = {},
): void {
  const environment = options.environment ?? process.env;
  try {
    if (
      !getObservabilityEnvironment(environment).SAFE_OPERATIONAL_LOGGING_ENABLED
    ) {
      return;
    }
    const serializedEvent = JSON.stringify(
      buildSafeOperationalEvent(input, { ...options, environment }),
    );
    (options.sink ?? console.info)(serializedEvent);
  } catch {
    // Telemetry delivery must not alter the application response.
  }
}
