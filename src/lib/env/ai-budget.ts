import "server-only";

import { z } from "zod";

const schema = z.object({
  AI_GENERATION_ENABLED: z
    .enum(["true", "false"])
    .transform((value) => value === "true"),
  AI_MONTHLY_REQUEST_CAP: z.coerce.number().int().min(1).max(1_000_000),
  AI_BUDGET_STOP_PERCENT: z.coerce.number().int().min(1).max(100),
  SUPABASE_DB_URL: z.string().url(),
});

export type AiBudgetEnvironment = z.infer<typeof schema>;

/** Fail-closed, server-only configuration for the shared AI circuit breaker. */
export function getAiBudgetEnvironment(
  environment: Record<string, string | undefined> = process.env,
): AiBudgetEnvironment {
  return schema.parse({
    AI_GENERATION_ENABLED: environment.AI_GENERATION_ENABLED,
    AI_MONTHLY_REQUEST_CAP: environment.AI_MONTHLY_REQUEST_CAP,
    AI_BUDGET_STOP_PERCENT: environment.AI_BUDGET_STOP_PERCENT,
    SUPABASE_DB_URL: environment.SUPABASE_DB_URL,
  });
}
