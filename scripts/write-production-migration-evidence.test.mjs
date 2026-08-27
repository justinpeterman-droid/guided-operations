import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";

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
    assert.equal(evidence.command_evidence.dry_run, null);
  });

  it("drops every invalid workflow-dispatch value before retention", () => {
    const marker = "<SECRET_ATTACK_MARKER>";
    const evidence = buildProductionMigrationEvidence({
      operation: marker,
      result: marker,
      candidateSha: marker,
      expectedMigrationHead: marker,
      projectRef: marker,
      region: marker,
      approvalReference: marker,
      backupEvidenceReference: marker,
      dryRunEvidenceReference: marker,
      repository: marker,
      runId: marker,
      runAttempt: marker,
      startedAt: marker,
      completedAt: marker,
      files: { [marker]: marker },
    });

    assert.equal(JSON.stringify(evidence).includes(marker), false);
    assert.equal(evidence.operation, null);
    assert.equal(evidence.project_reference_sha256, null);
    assert.equal(evidence.workflow.repository, null);
    assert.deepEqual(Object.keys(evidence.command_evidence), [
      "migration_history_before",
      "dry_run",
      "apply",
      "migration_history_after",
    ]);
  });

  it("retains guard-valid maximum-length references", () => {
    const reference = `R${"a".repeat(159)}`;
    const evidence = buildProductionMigrationEvidence({
      operation: "apply",
      result: "failure",
      candidateSha: "a".repeat(40),
      expectedMigrationHead: "20260827063000",
      projectRef: "abcdefghijklmnopqrst",
      region: "us-east-1",
      approvalReference: reference,
      backupEvidenceReference: reference,
      dryRunEvidenceReference: reference,
      repository: "owner/repository",
      runId: "123",
      runAttempt: "1",
      startedAt: "2026-08-27T00:00:00Z",
      completedAt: "2026-08-27T00:01:00Z",
      files: {},
    });
    assert.equal(evidence.approval_reference, reference);
    assert.equal(evidence.backup_evidence_reference, reference);
  });

  it("never writes or uploads evidence after request validation rejects", () => {
    const workflow = readFileSync(
      new URL("../.github/workflows/production-database.yml", import.meta.url),
      "utf8",
    );
    assert.match(
      workflow,
      /Write value-free migration evidence[\s\S]*?if: always\(\) && steps\.validate_request\.outcome == 'success'/u,
    );
    assert.match(
      workflow,
      /Retain value-free migration evidence[\s\S]*?always\(\) && steps\.validate_request\.outcome == 'success'/u,
    );
  });
});
