import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  AUTH_DEVICE_COOKIE_NAME,
  createAuthRequestRateLimitSubjects,
} from "./request-rate-limit-subjects";

const hmacKey = "test-only-hmac-key";

describe("createAuthRequestRateLimitSubjects", () => {
  it("uses an existing opaque device cookie without returning its raw value", () => {
    const deviceValue = "d".repeat(43);
    const subjects = createAuthRequestRateLimitSubjects(
      new Headers({
        cookie: `${AUTH_DEVICE_COOKIE_NAME}=${deviceValue}`,
        "x-vercel-forwarded-for": "203.0.113.9",
      }),
      hmacKey,
    );

    expect(subjects.deviceCookieValue).toBeUndefined();
    expect(subjects.deviceDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(subjects.networkDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(subjects)).not.toContain(deviceValue);
    expect(JSON.stringify(subjects)).not.toContain("203.0.113.9");
  });

  it("generates a cookie value only for a response when one is missing", () => {
    const subjects = createAuthRequestRateLimitSubjects(
      new Headers({ "x-vercel-forwarded-for": "203.0.113.9" }),
      hmacKey,
    );

    expect(subjects.deviceCookieValue).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(JSON.stringify(subjects)).not.toContain("203.0.113.9");
  });

  it("uses a stable opaque fallback when Vercel has no client network header", () => {
    const first = createAuthRequestRateLimitSubjects(new Headers(), hmacKey);
    const second = createAuthRequestRateLimitSubjects(new Headers(), hmacKey);

    expect(first.networkDigest).toBe(second.networkDigest);
    expect(first.globalDigest).toBe(second.globalDigest);
  });
});
