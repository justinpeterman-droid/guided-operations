import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/server/auth/supabase-auth-adapters", () => ({
  createSupabaseAuthAdminClient: vi.fn(),
}));

import { createSupabaseAuthAdminClient } from "@/server/auth/supabase-auth-adapters";

import { createSupabaseRetentionArtifactCleanup } from "./supabase-retention-artifact-cleanup";

const artifact = {
  artifactId: "11111111-1111-4111-8111-111111111111",
  storageBucket: "generated-exports" as const,
  storagePath: "fictional/approved-export.pdf",
  sha256: "a".repeat(64),
  byteSize: 128,
};

function storageClient(
  options?: Readonly<{
    removeError?: boolean;
    existsError?: boolean;
    exists?: boolean;
  }>,
) {
  const remove = vi.fn().mockResolvedValue({
    error: options?.removeError ? new Error("fictional remove failure") : null,
  });
  const exists = vi.fn().mockResolvedValue({
    data: options?.exists ?? false,
    error: options?.existsError ? new Error("fictional verify failure") : null,
  });
  const from = vi.fn(() => ({ remove, exists }));
  return { client: { storage: { from } }, from, remove, exists };
}

describe("Supabase retention artifact cleanup", () => {
  beforeEach(() => vi.clearAllMocks());

  it("removes only registered paths and verifies each is absent", async () => {
    const storage = storageClient();
    vi.mocked(createSupabaseAuthAdminClient).mockReturnValue(
      storage.client as never,
    );

    await createSupabaseRetentionArtifactCleanup().removeAndVerify([artifact]);

    expect(storage.from).toHaveBeenCalledWith("generated-exports");
    expect(storage.remove).toHaveBeenCalledWith([artifact.storagePath]);
    expect(storage.exists).toHaveBeenCalledWith(artifact.storagePath);
  });

  it.each([{ removeError: true }, { existsError: true }, { exists: true }])(
    "fails closed on removal or absence-verification failure",
    async (options) => {
      const storage = storageClient(options);
      vi.mocked(createSupabaseAuthAdminClient).mockReturnValue(
        storage.client as never,
      );

      await expect(
        createSupabaseRetentionArtifactCleanup().removeAndVerify([artifact]),
      ).rejects.toThrow();
    },
  );
});
