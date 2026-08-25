import { describe, expect, it, vi } from "vitest";

import { hasSupabaseReadiness } from "./supabase-readiness";

describe("Supabase readiness", () => {
  it("checks the REST endpoint with the publishable key and no cache", async () => {
    const request = vi.fn().mockResolvedValue({ ok: true });

    await expect(
      hasSupabaseReadiness(
        "https://project.supabase.co",
        "publishable",
        request,
      ),
    ).resolves.toBe(true);

    expect(request).toHaveBeenCalledWith(
      new URL("https://project.supabase.co/auth/v1/settings"),
      expect.objectContaining({
        cache: "no-store",
        headers: { apikey: "publishable" },
      }),
    );
  });

  it("reports false for an unhealthy endpoint", async () => {
    await expect(
      hasSupabaseReadiness(
        "https://project.supabase.co/",
        "publishable",
        vi.fn().mockResolvedValue({ ok: false }),
      ),
    ).resolves.toBe(false);
  });
});
