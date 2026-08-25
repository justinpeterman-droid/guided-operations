import { describe, expect, it } from "vitest";

import { evaluateAuthRateLimit, type AuthRateLimitPolicy } from "./rate-limit";

const policy: AuthRateLimitPolicy = {
  account: { limit: 3, windowMs: 60_000 },
  device: { limit: 4, windowMs: 60_000 },
  network: { limit: 5, windowMs: 60_000 },
  global: { limit: 10, windowMs: 60_000 },
};

const emptySubjects = {
  accountAttempts: [],
  deviceAttempts: [],
  networkAttempts: [],
  globalAttempts: [],
};

describe("evaluateAuthRateLimit", () => {
  it("allows an attempt below every independent threshold", () => {
    expect(evaluateAuthRateLimit(emptySubjects, policy, 100_000)).toEqual({
      allowed: true,
    });
  });

  it("returns one generic denial when any subject is over limit", () => {
    const decision = evaluateAuthRateLimit(
      {
        ...emptySubjects,
        accountAttempts: [50_000, 60_000, 70_000],
      },
      policy,
      100_000,
    );

    expect(decision).toEqual({ allowed: false, retryAfterMs: 10_000 });
    expect(Object.keys(decision)).not.toContain("subject");
  });

  it("uses the longest active retry interval across dimensions", () => {
    expect(
      evaluateAuthRateLimit(
        {
          ...emptySubjects,
          accountAttempts: [60_000, 70_000, 80_000],
          networkAttempts: [45_000, 50_000, 55_000, 60_000, 65_000],
        },
        policy,
        100_000,
      ),
    ).toEqual({ allowed: false, retryAfterMs: 20_000 });
  });

  it("expires attempts exactly at the end of their window", () => {
    expect(
      evaluateAuthRateLimit(
        {
          ...emptySubjects,
          accountAttempts: [40_000, 50_000, 60_000],
        },
        policy,
        100_000,
      ),
    ).toEqual({ allowed: true });
  });

  it("rejects malformed policy values rather than weakening limits", () => {
    expect(() =>
      evaluateAuthRateLimit(emptySubjects, {
        ...policy,
        account: { limit: 0, windowMs: 60_000 },
      }),
    ).toThrow("positive integer");
  });
});
