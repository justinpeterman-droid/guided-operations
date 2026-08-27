import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { verifyMigrationHistory } from "./verify-production-migration-history.mjs";

const versions = ["20260827010000", "20260827020000", "20260827023000"];

function payload(remoteCount) {
  return {
    migrations: versions.map((local, index) => ({
      local,
      remote: index < remoteCount ? local : "",
    })),
  };
}

describe("production migration history verifier", () => {
  it("allows a clean remote prefix before dry-run", () => {
    const result = verifyMigrationHistory(payload(2), versions.at(-1), false);
    assert.equal(result.ok, true);
    assert.equal(result.remoteHead, versions[1]);
  });

  it("requires the exact approved head after apply", () => {
    assert.equal(
      verifyMigrationHistory(payload(2), versions.at(-1), true).ok,
      false,
    );
    assert.equal(
      verifyMigrationHistory(payload(3), versions.at(-1), true).ok,
      true,
    );
  });

  it("rejects remote-only or mismatched migration history", () => {
    const result = verifyMigrationHistory(
      {
        migrations: [
          { local: versions[0], remote: versions[0] },
          { local: versions[1], remote: "20260827015000" },
          { local: versions[2], remote: "" },
        ],
      },
      versions.at(-1),
      false,
    );
    assert.equal(result.ok, false);
    assert.match(
      result.errors.join(" "),
      /not represented|exact candidate prefix/u,
    );
  });
});
