import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(),
}));
vi.mock("@/server/auth/current-session", () => ({
  authorizeCurrentSession: vi.fn(),
}));

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { authorizeCurrentSession } from "@/server/auth/current-session";

import { GET } from "./route";

describe("GET /api/auth/session", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns only the minimum browser-safe current account state", async () => {
    vi.mocked(createSupabaseServerClient).mockResolvedValue({} as never);
    vi.mocked(authorizeCurrentSession).mockResolvedValue({
      allowed: true,
      account: {
        authUserId: "11111111-1111-4111-8111-111111111111",
        facilityId: "22222222-2222-4222-8222-222222222222",
        shiftCode: null,
        role: "officer",
        status: "active",
        authVersion: 1,
        mustChangePasscode: false,
      },
      sessionId: "33333333-3333-4333-8333-333333333333",
    });

    const response = await GET();

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    await expect(response.json()).resolves.toEqual({
      data: { role: "officer", mustChangePasscode: false },
    });
  });

  it("does not reveal account state for a missing or stale session", async () => {
    vi.mocked(createSupabaseServerClient).mockResolvedValue({} as never);
    vi.mocked(authorizeCurrentSession).mockResolvedValue({
      allowed: false,
      reason: "session_revoked",
    });

    const response = await GET();

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: "authentication_required",
    });
  });
});
