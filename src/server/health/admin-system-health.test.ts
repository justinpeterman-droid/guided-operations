import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/env/runtime", () => ({
  getRuntimeEnvironment: vi.fn().mockReturnValue({ appEnvironment: "preview" }),
}));
vi.mock("@/lib/env/supabase-public", () => ({
  getPublicSupabaseEnvironment: vi.fn().mockReturnValue({
    NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "publishable-key",
  }),
}));

import { getAdminSystemHealth } from "./admin-system-health";

const adminAccount = {
  auth_user_id: "11111111-1111-4111-8111-111111111111",
  facility_id: "22222222-2222-4222-8222-222222222222",
  role: "administrator",
  status: "active",
  auth_version: 1,
  must_change_passcode: false,
};

function client(account: unknown = adminAccount) {
  return {
    auth: {
      getClaims: vi.fn().mockResolvedValue({
        data: {
          claims: {
            sub: adminAccount.auth_user_id,
            session_id: "33333333-3333-4333-8333-333333333333",
            app_metadata: { auth_version: 1 },
          },
        },
        error: null,
      }),
    },
    rpc: vi.fn().mockResolvedValue({ data: [account], error: null }),
  };
}

describe("getAdminSystemHealth", () => {
  it("returns only safe component readiness to an administrator", async () => {
    const checkSupabase = vi.fn().mockResolvedValue(true);

    await expect(
      getAdminSystemHealth(client(), checkSupabase),
    ).resolves.toEqual({
      kind: "ready",
      application: "ready",
      supabase: "ready",
    });
    expect(checkSupabase).toHaveBeenCalledWith(
      "https://example.supabase.co",
      "publishable-key",
    );
  });

  it("reports a truthful unavailable dependency without revealing its error", async () => {
    await expect(
      getAdminSystemHealth(client(), vi.fn().mockResolvedValue(false)),
    ).resolves.toEqual({
      kind: "ready",
      application: "ready",
      supabase: "unavailable",
    });
  });

  it("denies an officer before any dependency check", async () => {
    const checkSupabase = vi.fn();
    await expect(
      getAdminSystemHealth(
        client({ ...adminAccount, role: "officer" }),
        checkSupabase,
      ),
    ).resolves.toEqual({ kind: "denied" });
    expect(checkSupabase).not.toHaveBeenCalled();
  });
});
