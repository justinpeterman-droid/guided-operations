import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/env/auth-server", () => ({
  getAuthServerEnvironment: vi.fn(() => ({
    SUPABASE_DB_URL: "https://db.example.invalid",
  })),
}));

import { retentionDeletionStoreInternals } from "./private-retention-deletion-store";

describe("retention deletion manifest", () => {
  it("matches the database empty-manifest digest", () => {
    expect(retentionDeletionStoreInternals.manifestSha256([])).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    );
  });

  it("sorts immutable artifact IDs before hashing", () => {
    const first = {
      artifactId: "11111111-1111-4111-8111-111111111111",
      storageBucket: "generated-exports" as const,
      storagePath:
        "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/report/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/fictional.pdf",
      sha256: "a".repeat(64),
      byteSize: 128,
    };
    const second = {
      ...first,
      artifactId: "22222222-2222-4222-8222-222222222222",
      storagePath: first.storagePath.replace("fictional", "fictional-2"),
    };

    expect(
      retentionDeletionStoreInternals.manifestSha256([second, first]),
    ).toBe(retentionDeletionStoreInternals.manifestSha256([first, second]));
  });
});
