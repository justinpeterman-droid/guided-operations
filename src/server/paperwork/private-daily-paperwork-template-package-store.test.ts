import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { prepareDailyPaperworkImport } from "./daily-paperwork-import-manifest";
import { fictionalDailyPaperworkSourcePackage } from "./daily-paperwork-source-package.test-fixture";
import { verifyDailyPaperworkSourcePackage } from "./daily-paperwork-source-package";
import {
  createDailyPaperworkTemplatePackageStore,
  dailyPaperworkTemplatePackageStoreInternals,
} from "./private-daily-paperwork-template-package-store";

const hmacKey = "k".repeat(32);

describe("private Daily Paperwork template package store", () => {
  it("sends only digest-bound mapped entries to one private registration call", async () => {
    const register = vi
      .fn()
      .mockResolvedValue("00000000-0000-4000-8000-000000000099");
    const prepared = prepareDailyPaperworkImport(
      verifyDailyPaperworkSourcePackage(fictionalDailyPaperworkSourcePackage()),
      {
        facilityId: "00000000-0000-4000-8000-000000000001",
        sourceAuthority: "Fictional training records owner",
        sourceRevision: "fictional-revision-1",
        rightsStatus: "approved_internal_use",
        activeFrom: "2026-09-01",
        expectedCurrentPackageDigest: null,
        rollbackOfPackageDigest: null,
      },
    );
    const store = createDailyPaperworkTemplatePackageStore({ register });

    await expect(
      store.register({
        actorAuthUserId: "00000000-0000-4000-8000-000000000002",
        sessionId: "00000000-0000-4000-8000-000000000003",
        authVersion: 1,
        stepUpToken: "t".repeat(43),
        stepUpRequestId: "00000000-0000-4000-8000-000000000004",
        idempotencyKey: "fictional-idempotency-key-0001",
        hmacKey,
        prepared,
      }),
    ).resolves.toBe("00000000-0000-4000-8000-000000000099");

    expect(register).toHaveBeenCalledOnce();
    const input = register.mock.calls[0][0];
    expect(input.entries).toHaveLength(6);
    expect(input.stepUpTokenDigest).not.toContain("t".repeat(43));
    expect(input.idempotencyKeyDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(input.entries[0]).toMatchObject({
      kind: "assignment_roster",
      source_sha256: prepared.manifest.entries[0].sourceSha256,
      mapped_sha256: prepared.manifest.entries[0].mappedSha256,
    });
  });

  it("purpose-separates import and rollback proofs", async () => {
    const key = "same-client-key-000000000000";
    const digest =
      dailyPaperworkTemplatePackageStoreInternals.digestIdempotencyKey(
        key,
        hmacKey,
      );
    expect(digest).toMatch(/^[a-f0-9]{64}$/);
    expect(digest).not.toContain(key);
  });
});
