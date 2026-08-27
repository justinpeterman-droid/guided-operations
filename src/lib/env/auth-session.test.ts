import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { getAuthSessionEnvironment } from "./auth-session";

describe("auth session environment", () => {
  it("accepts an exact base64url-encoded 32-byte key", () => {
    expect(
      getAuthSessionEnvironment({
        AUTH_SESSION_ENCRYPTION_KEY:
          "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
      }),
    ).toEqual({
      AUTH_SESSION_ENCRYPTION_KEY:
        "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
    });
  });

  it.each([
    undefined,
    "",
    "a".repeat(42),
    "a".repeat(44),
    `${"a".repeat(42)}+`,
    `${"A".repeat(42)}B`,
  ])("rejects an absent or malformed key", (value) => {
    expect(() =>
      getAuthSessionEnvironment({ AUTH_SESSION_ENCRYPTION_KEY: value }),
    ).toThrow();
  });
});
