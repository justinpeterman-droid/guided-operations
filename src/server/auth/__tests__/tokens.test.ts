import { describe, expect, it } from "vitest";

import {
  hashOpaqueSecret,
  issueOpaqueToken,
  parseOpaqueToken,
} from "../tokens";
import { deriveCsrfToken, verifyCsrfToken } from "../csrf";

describe("opaque authentication tokens", () => {
  it("issues a UUID plus a 256-bit base64url secret", () => {
    const issued = issueOpaqueToken();

    expect(issued.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(issued.secret).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(parseOpaqueToken(issued.serialized)).toEqual({
      id: issued.id,
      secret: issued.secret,
    });
  });

  it("rejects malformed serialized tokens", () => {
    expect(parseOpaqueToken("not-a-session")).toBeNull();
    expect(parseOpaqueToken("00000000-0000-0000-0000-000000000000.short")).toBeNull();
  });

  it("stores only a keyed digest of a session secret", () => {
    const first = hashOpaqueSecret("secret", "session-key");
    const second = hashOpaqueSecret("secret", "session-key");
    const otherKey = hashOpaqueSecret("secret", "other-key");

    expect(first).toMatch(/^[a-f0-9]{64}$/);
    expect(second).toBe(first);
    expect(otherKey).not.toBe(first);
  });

  it("derives and constant-time verifies a session-bound CSRF token", () => {
    const sessionId = "3d3740e1-2c0e-45fc-8a25-c9d01cf6bd93";
    const token = deriveCsrfToken(sessionId, "session-secret", "csrf-key");
    const replacement = token.at(-1) === "A" ? "B" : "A";
    const tampered = `${token.slice(0, -1)}${replacement}`;

    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(
      verifyCsrfToken(
        token,
        sessionId,
        "session-secret",
        "csrf-key",
      ),
    ).toBe(true);
    expect(
      verifyCsrfToken(
        tampered,
        sessionId,
        "session-secret",
        "csrf-key",
      ),
    ).toBe(false);
  });
});
