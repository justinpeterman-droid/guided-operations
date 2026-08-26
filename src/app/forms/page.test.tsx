import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(),
}));
vi.mock("@/server/auth/current-session", () => ({
  authorizeCurrentSession: vi.fn(),
}));

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { authorizeCurrentSession } from "@/server/auth/current-session";

import { loadFormsAccess } from "./page";

describe("loadFormsAccess", () => {
  beforeEach(() => vi.clearAllMocks());

  it("keeps the real Forms Library behind a verified current session", async () => {
    const client = {};
    vi.mocked(createSupabaseServerClient).mockResolvedValue(client as never);
    vi.mocked(authorizeCurrentSession).mockResolvedValue({
      allowed: false,
      reason: "missing_account",
    });

    await expect(loadFormsAccess()).resolves.toEqual({ kind: "denied" });
    expect(authorizeCurrentSession).toHaveBeenCalledWith(client);
  });

  it("carries the trusted shift assignment into form availability", async () => {
    vi.mocked(createSupabaseServerClient).mockResolvedValue({} as never);
    vi.mocked(authorizeCurrentSession).mockResolvedValue({
      allowed: true,
      account: { shiftCode: "U" },
      sessionId: "fixture-session",
    } as never);

    await expect(loadFormsAccess()).resolves.toEqual({
      kind: "authorized",
      shiftCode: "U",
    });
  });
});
