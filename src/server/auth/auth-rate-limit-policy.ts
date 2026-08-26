import type { AuthRateLimitPolicy } from "@/features/auth/rate-limit";

/**
 * Conservative preview policy. It is deliberately explicit and should be
 * measured against fictional-preview traffic before any live promotion.
 */
export const AUTH_RATE_LIMIT_POLICY: AuthRateLimitPolicy = {
  account: { limit: 5, windowMs: 15 * 60_000 },
  device: { limit: 10, windowMs: 15 * 60_000 },
  network: { limit: 25, windowMs: 15 * 60_000 },
  global: { limit: 200, windowMs: 15 * 60_000 },
};
