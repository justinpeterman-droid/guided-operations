import { describe, expect, it } from "vitest";

import {
  clearSessionCookie,
  getOrCreateDeviceId,
  networkIdentifierFromHeaders,
  setSessionCookie,
} from "../http";
import { mutationRequestIsSameOrigin } from "../request-security";

class MemoryCookies {
  readonly values = new Map<string, string>();
  readonly writes: Array<{
    name: string;
    value: string;
    options: {
      httpOnly: boolean;
      secure: boolean;
      sameSite: "lax";
      path: string;
      maxAge: number;
    };
  }> = [];

  get(name: string) {
    const value = this.values.get(name);
    return value === undefined ? undefined : { value };
  }

  set(
    name: string,
    value: string,
    options: {
      httpOnly: boolean;
      secure: boolean;
      sameSite: "lax";
      path: string;
      maxAge: number;
    },
  ) {
    this.values.set(name, value);
    this.writes.push({ name, value, options });
  }
}

function headers(values: Record<string, string | undefined>) {
  return {
    get(name: string) {
      return values[name.toLowerCase()] ?? null;
    },
  };
}

describe("authentication HTTP boundary", () => {
  it("creates a persistent HttpOnly device identifier when absent", () => {
    const cookies = new MemoryCookies();
    const device = getOrCreateDeviceId(cookies, true);

    expect(device).toMatch(/^[0-9a-f-]{36}$/);
    expect(cookies.writes[0]).toEqual(
      expect.objectContaining({
        name: "go_device",
        value: device,
        options: expect.objectContaining({
          httpOnly: true,
          secure: true,
          sameSite: "lax",
          path: "/",
        }),
      }),
    );
  });

  it("sets and clears the opaque session with the required cookie attributes", () => {
    const cookies = new MemoryCookies();
    setSessionCookie(cookies, "session-token", true);
    clearSessionCookie(cookies, true);

    expect(cookies.writes[0]).toEqual({
      name: "go_session",
      value: "session-token",
      options: {
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        path: "/",
        maxAge: 43_200,
      },
    });
    expect(cookies.writes[1]?.options.maxAge).toBe(0);
  });

  it("uses Vercel's platform forwarding header instead of caller forwarding", () => {
    const original = process.env.VERCEL;
    process.env.VERCEL = "1";
    try {
      expect(
        networkIdentifierFromHeaders(
          headers({
            "x-vercel-forwarded-for": "203.0.113.9, 10.0.0.1",
            "x-forwarded-for": "192.0.2.99",
          }),
        ),
      ).toBe("203.0.113.9");
      expect(
        networkIdentifierFromHeaders(
          headers({ "x-forwarded-for": "192.0.2.99" }),
        ),
      ).toBe("unknown-network");
    } finally {
      process.env.VERCEL = original;
    }
  });

  it("requires the exact configured origin and rejects cross-site mutations", () => {
    const origin = "https://guided-operations.vercel.app";

    expect(
      mutationRequestIsSameOrigin(
        headers({ origin, "sec-fetch-site": "same-origin" }),
        origin,
      ),
    ).toBe(true);
    expect(
      mutationRequestIsSameOrigin(
        headers({ origin: "https://example.com", "sec-fetch-site": "same-origin" }),
        origin,
      ),
    ).toBe(false);
    expect(
      mutationRequestIsSameOrigin(
        headers({ origin, "sec-fetch-site": "cross-site" }),
        origin,
      ),
    ).toBe(false);
  });
});
