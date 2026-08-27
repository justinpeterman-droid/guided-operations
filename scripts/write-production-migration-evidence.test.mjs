import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildProductionMigrationEvidence } from "./write-production-migration-evidence.mjs";

describe("production migration evidence", () => {
  it("keeps the target project opaque and stores no command content", () => {
    const projectRef = "abcdefghijklmnopqrst";
    const evidence = buildProductionMigrationEvidence({
      operation: "dry-run",
      result: "success",
      candidateSha: "a".repeat(40),
      expectedMigrationHead: "20260827023000",
      projectRef,
      region: "us-east-1",
      approvalReference: "OWNER-APPROVAL-001",
      backupEvidenceReference: "",
      dryRunEvidenceReference: "",
      repository: "owner/repository",
      runId: "123",
      runAttempt: "1",
      startedAt: "2026-08-27T00:00:00.000Z",
      completedAt: "2026-08-27T00:01:00.000Z",
      files: {},
    });
    const serialized = JSON.stringify(evidence);
    assert.equal(serialized.includes(projectRef), false);
    assert.equal(evidence.backup_evidence_reference, null);
    assert.equal(evidence.command_evidence.dry_run, undefined);
  });
});
