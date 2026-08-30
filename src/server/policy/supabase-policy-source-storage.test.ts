import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { createSupabasePolicySourceStorageReader } from "./supabase-policy-source-storage";

describe("Supabase policy source Storage adapter", () => {
  it("exposes only exact-object download through the supplied user session", async () => {
    const pdf = new Blob(["%PDF-fictional"], { type: "application/pdf" });
    const download = vi.fn().mockResolvedValue({ data: pdf, error: null });
    const from = vi.fn().mockReturnValue({ download });

    const reader = createSupabasePolicySourceStorageReader({
      storage: { from },
    });
    await expect(
      reader.download("policy-sources", "opaque/hash.pdf"),
    ).resolves.toEqual({ data: pdf, error: null });

    expect(from).toHaveBeenCalledWith("policy-sources");
    expect(download).toHaveBeenCalledWith("opaque/hash.pdf");
    expect(Object.keys(reader)).toEqual(["download"]);
  });
});
