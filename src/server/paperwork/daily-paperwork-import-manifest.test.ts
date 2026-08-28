import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  prepareDailyPaperworkImport,
  summarizeDailyPaperworkImport,
} from "./daily-paperwork-import-manifest";
import { fictionalDailyPaperworkSourcePackage } from "./daily-paperwork-source-package.test-fixture";
import { verifyDailyPaperworkSourcePackage } from "./daily-paperwork-source-package";

const metadata = {
  facilityId: "00000000-0000-4000-8000-000000000001",
  sourceAuthority: "Fictional training records owner",
  sourceRevision: "fictional-revision-1",
  rightsStatus: "approved_internal_use" as const,
  activeFrom: "2026-09-01",
  expectedCurrentPackageDigest: null,
  rollbackOfPackageDigest: null,
};

describe("Daily Paperwork private import manifest", () => {
  it("binds six source and mapped digests into deterministic value-free evidence", () => {
    const verified = verifyDailyPaperworkSourcePackage(
      fictionalDailyPaperworkSourcePackage(),
    );
    const first = prepareDailyPaperworkImport(verified, metadata);
    const second = prepareDailyPaperworkImport(verified, metadata);
    const summary = summarizeDailyPaperworkImport(first);

    expect(first.manifest.packageDigest).toBe(second.manifest.packageDigest);
    expect(first.manifest.entries).toHaveLength(6);
    expect(summary.sourceCount).toBe(6);
    expect(
      summary.entries.every((entry) => entry.mappedSha256.length === 64),
    ).toBe(true);
    expect(JSON.stringify(summary)).not.toContain("Fictional");
  });

  it("changes the package digest when exact source bytes change", () => {
    const original = fictionalDailyPaperworkSourcePackage();
    const changed = fictionalDailyPaperworkSourcePackage();
    const decoded = JSON.parse(new TextDecoder().decode(changed[4].bytes));
    decoded.title = "Fictional Search Log Revised";
    changed[4] = {
      filename: changed[4].filename,
      bytes: new TextEncoder().encode(JSON.stringify(decoded)),
    };

    const originalDigest = prepareDailyPaperworkImport(
      verifyDailyPaperworkSourcePackage(original),
      metadata,
    ).manifest.packageDigest;
    const changedDigest = prepareDailyPaperworkImport(
      verifyDailyPaperworkSourcePackage(changed),
      metadata,
    ).manifest.packageDigest;

    expect(changedDigest).not.toBe(originalDigest);
  });

  it("rejects unapproved rights and ambiguous evidence text", () => {
    const verified = verifyDailyPaperworkSourcePackage(
      fictionalDailyPaperworkSourcePackage(),
    );
    expect(() =>
      prepareDailyPaperworkImport(verified, {
        ...metadata,
        sourceRevision: "<unreviewed>",
      }),
    ).toThrow();
    expect(() =>
      prepareDailyPaperworkImport(verified, {
        ...metadata,
        rightsStatus: "quarantined" as "approved_internal_use",
      }),
    ).toThrow();
  });
});
