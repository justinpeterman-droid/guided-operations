import "server-only";

import { z } from "zod";

import { getAuthServerEnvironment } from "@/lib/env/auth-server";
import { getAiBudgetEnvironment } from "@/lib/env/ai-budget";
import { getIncidentServerEnvironment } from "@/lib/env/incident-server";
import { getOpenAiPolicyEnvironment } from "@/lib/env/openai-policy";
import { getOpenAiReportDraftEnvironment } from "@/lib/env/openai-report-draft";
import { getObservabilityEnvironment } from "@/lib/env/observability";
import { getRuntimeEnvironment } from "@/lib/env/runtime";
import { getPublicSupabaseEnvironment } from "@/lib/env/supabase-public";

const aiEnvironmentSchema = z.object({
  AI_PROVIDER: z.literal("openai"),
  OPENAI_EMBEDDING_MODEL: z.string().trim().min(1).max(160),
  RAG_CORPUS_VERSION: z
    .string()
    .trim()
    .regex(/^[a-z0-9][a-z0-9._-]{1,159}$/),
});

/**
 * Validates the complete runtime contract without returning or logging secret
 * values. A public readiness response may use only the success/failure result.
 */
export function assertApplicationEnvironmentReadiness(
  environment: Record<string, string | undefined> = process.env,
) {
  const runtime = getRuntimeEnvironment(environment);
  getAiBudgetEnvironment(environment);
  const publicSupabase = getPublicSupabaseEnvironment(environment);
  const auth = getAuthServerEnvironment(environment);
  const incident = getIncidentServerEnvironment(environment);
  const observability = getObservabilityEnvironment(environment);
  getOpenAiPolicyEnvironment(environment);
  getOpenAiReportDraftEnvironment(environment);
  aiEnvironmentSchema.parse({
    AI_PROVIDER: environment.AI_PROVIDER,
    OPENAI_EMBEDDING_MODEL: environment.OPENAI_EMBEDDING_MODEL,
    RAG_CORPUS_VERSION: environment.RAG_CORPUS_VERSION,
  });

  if (runtime.APP_ENV === "production" && !auth.AUTH_SIGN_IN_ENABLED) {
    throw new Error("Production sign-in must be explicitly enabled.");
  }
  if (
    runtime.APP_ENV === "production" &&
    !observability.SAFE_OPERATIONAL_LOGGING_ENABLED
  ) {
    throw new Error("Production safe operational logging must be enabled.");
  }

  const dedicatedSecrets = new Set([
    auth.EMPLOYEE_LOOKUP_PEPPER,
    auth.CSRF_HMAC_KEY,
    incident.INCIDENT_IDEMPOTENCY_HMAC_KEY,
  ]);
  if (dedicatedSecrets.size !== 3) {
    throw new Error("Security keys must be unique per purpose.");
  }

  return { publicSupabase };
}
