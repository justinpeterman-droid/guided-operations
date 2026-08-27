import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@supabase/supabase-js", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/env/auth-server", () => ({
  getAuthServerEnvironment: vi.fn(),
}));
vi.mock("@/lib/env/supabase-public", () => ({
  getPublicSupabaseEnvironment: vi.fn(),
}));

import { createClient } from "@supabase/supabase-js";

import { getAuthServerEnvironment } from "@/lib/env/auth-server";
import { getPublicSupabaseEnvironment } from "@/lib/env/supabase-public";

import { createSupabasePolicySourceStorageReader } from "./supabase-policy-source-storage";

describe("Supabase policy source Storage adapter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("exposes only exact-object download through a non-persistent server client", async () => {
    const pdf = new Blob(["%PDF-fictional"], { type: "application/pdf" });
    const download = vi.fn().mockResolvedValue({ data: pdf, error: null });
    const from = vi.fn().mockReturnValue({ download });
    vi.mocked(getAuthServerEnvironment).mockReturnValue({
      SUPABASE_SECRET_KEY: "fictional-server-secret",
    } as never);
    vi.mocked(getPublicSupabaseEnvironment).mockReturnValue({
      NEXT_PUBLIC_SUPABASE_URL: "https://fictional.supabase.test",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "unused",
    });
    vi.mocked(createClient).mockReturnValue({ storage: { from } } as never);

    const reader = createSupabasePolicySourceStorageReader();
    await expect(
      reader.download("policy-sources", "opaque/hash.pdf"),
    ).resolves.toEqual({ data: pdf, error: null });

    expect(createClient).toHaveBeenCalledWith(
      "https://fictional.supabase.test",
      "fictional-server-secret",
      { auth: { autoRefreshToken: false, persistSession: false } },
    );
    expect(from).toHaveBeenCalledWith("policy-sources");
    expect(download).toHaveBeenCalledWith("opaque/hash.pdf");
    expect(Object.keys(reader)).toEqual(["download"]);
  });
});
