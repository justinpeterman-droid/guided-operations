import "server-only";

import { z } from "zod";

const schema = z.object({
  AI_GENERATION_ENABLED: z
    .enum(["true", "false"])
    .transform((value) => value === "true"),
  AI_MONTHLY_REQUEST_CAP: z.coerce.number().int().min(1).max(1_000_000),
  AI_BUDGET_STOP_PERCENT: z.coerce.number().int().min(1).max(100),
  AI_ACCOUNT_MONTHLY_SHARE_PERCENT: z.coerce
    .number()
    .int()
    .min(1)
    .max(20)
    .default(5),
  AI_ACCOUNT_SHORT_WINDOW_MAX: z.coerce
    .number()
    .int()
    .min(1)
    .max(100)
    .default(6),
  AI_ACCOUNT_CONCURRENCY_MAX: z.coerce.number().int().min(1).max(10).default(2),
  AI_REQUEST_LEASE_SECONDS: z.coerce
    .number()
    .int()
    .min(30)
    .max(300)
    .default(90),
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
    AI_ACCOUNT_MONTHLY_SHARE_PERCENT:
      environment.AI_ACCOUNT_MONTHLY_SHARE_PERCENT,
    AI_ACCOUNT_SHORT_WINDOW_MAX: environment.AI_ACCOUNT_SHORT_WINDOW_MAX,
    AI_ACCOUNT_CONCURRENCY_MAX: environment.AI_ACCOUNT_CONCURRENCY_MAX,
    AI_REQUEST_LEASE_SECONDS: environment.AI_REQUEST_LEASE_SECONDS,
    SUPABASE_DB_URL: environment.SUPABASE_DB_URL,
  });
}
