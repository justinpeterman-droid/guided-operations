import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/server/auth/current-session", () => ({
  authorizeCurrentSession: vi.fn(),
}));

import { authorizeCurrentSession } from "@/server/auth/current-session";

import {
  createDailyPaperworkTemplatePackageHistoryStore,
  listDailyPaperworkTemplatePackagesForCurrentSession,
} from "./list-daily-paperwork-template-packages";

const facilityId = "00000000-0000-4000-8000-000000000001";
const packageRow = {
  package_id: "00000000-0000-4000-8000-000000000010",
  package_digest: "a".repeat(64),
  mapping_version: "daily-paperwork-source-to-form-v1",
  source_authority: "Fictional training records owner",
  source_revision: "fictional-revision-1",
  active_from: "2026-09-01",
  rollback_of_package_digest: null,
  source_count: 6,
  total_source_bytes: 4096,
  approved_at: "2026-08-28T18:00:00+00:00",
};

describe("Daily Paperwork template package history", () => {
  beforeEach(() => vi.clearAllMocks());

  it("maps only value-free package evidence from the private store", async () => {
    const list = vi.fn().mockResolvedValue([packageRow]);
    const store = createDailyPaperworkTemplatePackageHistoryStore({ list });

    await expect(store.list(facilityId, 20)).resolves.toEqual([
      {
        packageId: packageRow.package_id,
        packageDigest: packageRow.package_digest,
        mappingVersion: packageRow.mapping_version,
        sourceAuthority: packageRow.source_authority,
        sourceRevision: packageRow.source_revision,
        activeFrom: packageRow.active_from,
        rollbackOfPackageDigest: null,
        sourceCount: 6,
        totalSourceBytes: 4096,
        approvedAt: packageRow.approved_at,
      },
    ]);
    expect(list).toHaveBeenCalledWith(facilityId, 20);
  });

  it("rejects a non-RFC3339 database timestamp", async () => {
    const store = createDailyPaperworkTemplatePackageHistoryStore({
      list: vi
        .fn()
        .mockResolvedValue([
          { ...packageRow, approved_at: "2026-08-28 18:00:00+00" },
        ]),
    });

    await expect(store.list(facilityId, 20)).rejects.toThrow();
  });

  it("derives the facility from the current administrator session", async () => {
    vi.mocked(authorizeCurrentSession).mockResolvedValue({
      allowed: true,
      account: { facilityId },
    } as never);
    const store = { list: vi.fn().mockResolvedValue([]) };

    await expect(
      listDailyPaperworkTemplatePackagesForCurrentSession(
        {} as never,
        20,
        store,
      ),
    ).resolves.toEqual({ kind: "listed", packages: [] });
    expect(store.list).toHaveBeenCalledWith(facilityId, 20);
  });

  it("does not query package history for an officer", async () => {
    vi.mocked(authorizeCurrentSession).mockResolvedValue({
      allowed: false,
      reason: "role_required",
    } as never);
    const store = { list: vi.fn() };

    await expect(
      listDailyPaperworkTemplatePackagesForCurrentSession(
        {} as never,
        20,
        store,
      ),
    ).resolves.toEqual({ kind: "denied" });
    expect(store.list).not.toHaveBeenCalled();
  });
});
