import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { parseSessionAuthority } from "./session-claims";

describe("parseSessionAuthority", () => {
  it("accepts only a UUID subject with a positive app auth version", () => {
    expect(
      parseSessionAuthority({
        sub: "11111111-1111-4111-8111-111111111111",
        session_id: "22222222-2222-4222-8222-222222222222",
        app_metadata: { auth_version: 4, unrelated: "ignored" },
        user_metadata: { auth_version: 999 },
      }),
    ).toEqual({
      authUserId: "11111111-1111-4111-8111-111111111111",
      sessionId: "22222222-2222-4222-8222-222222222222",
      authVersion: 4,
    });
  });

  it.each([
    {},
    {
      sub: "not-a-uuid",
      session_id: "22222222-2222-4222-8222-222222222222",
      app_metadata: { auth_version: 1 },
    },
    {
      sub: "11111111-1111-4111-8111-111111111111",
      session_id: "22222222-2222-4222-8222-222222222222",
      app_metadata: {},
    },
    {
      sub: "11111111-1111-4111-8111-111111111111",
      session_id: "22222222-2222-4222-8222-222222222222",
      app_metadata: { auth_version: 0 },
    },
    {
      sub: "11111111-1111-4111-8111-111111111111",
      session_id: "22222222-2222-4222-8222-222222222222",
      user_metadata: { auth_version: 3 },
    },
  ])("fails closed for missing or unsafe claims", (claims) => {
    expect(parseSessionAuthority(claims)).toBeNull();
  });
});
