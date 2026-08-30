import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  createCsrfToken,
  createCsrfTokenDigest,
  hasValidCsrfToken,
} from "./csrf";

const hmacKey = "test-only-csrf-hmac-key";
const sessionId = "session-fixture-1";

describe("session-bound CSRF tokens", () => {
  it("creates opaque tokens with sufficient random bytes", () => {
    const token = createCsrfToken();

    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(Buffer.from(token, "base64url")).toHaveLength(32);
    expect(createCsrfToken()).not.toBe(token);
  });

  it("accepts only the digest bound to the same session", () => {
    const token = "fixture-csrf-token";
    const digest = createCsrfTokenDigest(token, sessionId, hmacKey);

    expect(hasValidCsrfToken(token, digest, sessionId, hmacKey)).toBe(true);
    expect(hasValidCsrfToken(token, digest, "different-session", hmacKey)).toBe(
      false,
    );
  });

  it("rejects missing, altered, and malformed inputs", () => {
    const token = "fixture-csrf-token";
    const digest = createCsrfTokenDigest(token, sessionId, hmacKey);

    expect(hasValidCsrfToken(null, digest, sessionId, hmacKey)).toBe(false);
    expect(hasValidCsrfToken(token, null, sessionId, hmacKey)).toBe(false);
    expect(hasValidCsrfToken("altered", digest, sessionId, hmacKey)).toBe(
      false,
    );
    expect(hasValidCsrfToken(token, "not base64url", sessionId, hmacKey)).toBe(
      false,
    );
  });
});
