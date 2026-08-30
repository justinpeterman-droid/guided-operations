import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(),
}));
vi.mock("@/server/auth/current-session", () => ({
  authorizeCurrentSession: vi.fn(),
}));

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { authorizeCurrentSession } from "@/server/auth/current-session";

import { loadAdminAccess } from "./page";

describe("loadAdminAccess", () => {
  beforeEach(() => vi.clearAllMocks());

  it("requires administrator authority from the server before the admin page can load", async () => {
    const client = {};
    vi.mocked(createSupabaseServerClient).mockResolvedValue(client as never);
    vi.mocked(authorizeCurrentSession).mockResolvedValue({
      allowed: false,
      reason: "insufficient_role",
    });

    await expect(loadAdminAccess()).resolves.toBe("denied");
    expect(authorizeCurrentSession).toHaveBeenCalledWith(client, {
      requiredRole: "administrator",
    });
  });

  it("allows only a verified administrator session", async () => {
    vi.mocked(createSupabaseServerClient).mockResolvedValue({} as never);
    vi.mocked(authorizeCurrentSession).mockResolvedValue({
      allowed: true,
      account: { role: "administrator" },
      sessionId: "fixture-session",
    } as never);

    await expect(loadAdminAccess()).resolves.toBe("authorized");
  });
});
