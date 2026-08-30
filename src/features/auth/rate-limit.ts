export type RateLimitWindow = Readonly<{
  limit: number;
  windowMs: number;
}>;

export type AuthRateLimitPolicy = Readonly<{
  account: RateLimitWindow;
  device: RateLimitWindow;
  network: RateLimitWindow;
  global: RateLimitWindow;
}>;

export type AuthAttemptSubjects = Readonly<{
  accountAttempts: readonly number[];
  deviceAttempts: readonly number[];
  networkAttempts: readonly number[];
  globalAttempts: readonly number[];
}>;

export type RateLimitDecision =
  | Readonly<{ allowed: true }>
  | Readonly<{ allowed: false; retryAfterMs: number }>;

function validateWindow(window: RateLimitWindow): void {
  if (!Number.isInteger(window.limit) || window.limit < 1) {
    throw new Error("Rate-limit window limit must be a positive integer");
  }

  if (!Number.isSafeInteger(window.windowMs) || window.windowMs < 1) {
    throw new Error("Rate-limit window duration must be a positive integer");
  }
}

function retryAfterForWindow(
  attempts: readonly number[],
  window: RateLimitWindow,
  now: number,
): number | null {
  validateWindow(window);
  const cutoff = now - window.windowMs;
  const recent = attempts.filter((attemptedAt) => attemptedAt > cutoff);

  if (recent.length < window.limit) return null;

  const oldestRelevantAttempt = Math.min(...recent);
  return Math.max(1, oldestRelevantAttempt + window.windowMs - now);
}

/**
 * Computes one generic decision across every abuse dimension. Callers must not
 * disclose which subject produced the denial.
 */
export function evaluateAuthRateLimit(
  subjects: AuthAttemptSubjects,
  policy: AuthRateLimitPolicy,
  now = Date.now(),
): RateLimitDecision {
  const retryAfters = [
    retryAfterForWindow(subjects.accountAttempts, policy.account, now),
    retryAfterForWindow(subjects.deviceAttempts, policy.device, now),
    retryAfterForWindow(subjects.networkAttempts, policy.network, now),
    retryAfterForWindow(subjects.globalAttempts, policy.global, now),
  ].filter((retryAfter): retryAfter is number => retryAfter !== null);

  if (retryAfters.length === 0) return { allowed: true };
  return { allowed: false, retryAfterMs: Math.max(...retryAfters) };
}
