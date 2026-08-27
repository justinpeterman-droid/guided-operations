import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { validateProductionReleaseRecord } from "./verify-production-release-record.mjs";

const candidateSha = "a".repeat(40);
const migrationHead = "20260827050000";
const deploymentId = "deployment_candidate_001";
const sha256 = "b".repeat(64);

function gate(overrides = {}) {
  return {
    status: "passed",
    evidenceReference: "EVIDENCE-REFERENCE-001",
    reviewedAtUtc: "2026-08-27T12:00:00Z",
    reviewer: "reviewer-001",
    ...overrides,
  };
}

function record(overrides = {}) {
  const gates = Object.fromEntries(
    [
      "webCi",
      "databaseCi",
      "authRlsStorage",
      "browserSmoke",
      "accessibility",
      "visualPrint",
      "ragEvaluation",
      "secretDependencyScan",
      "providerHealth",
      "monitoringAlerts",
      "budgetControls",
      "backupRestore",
      "rollbackRehearsal",
      "securityReview",
      "ownerProductAcceptance",
      "productionMigration",
      "productionSmoke",
      "productionAuthorization",
    ].map((name) => [name, gate()]),
  );
  gates.productionSmoke.reviewedAtUtc = "2026-08-27T12:20:00Z";
  return {
    schemaVersion: 1,
    releaseId: "release-2026-08-27-001",
    phase: "production",
    createdAtUtc: "2026-08-27T12:00:00Z",
    candidate: {
      gitSha: candidateSha,
      migrationHead,
      vercelDeploymentId: deploymentId,
      vercelDeploymentUrl: "https://candidate.example.test",
      configurationVersion: "config-version-001",
      pullRequests: ["https://github.com/example/project/pull/1"],
    },
    environment: {
      supabaseProjectAlias: "guided-operations-production",
      supabaseProjectRefSha256: sha256,
      region: "us-east-1",
      vercelProjectAlias: "guided-operations-production",
    },
    corpus: {
      manifestVersion: "corpus-version-001",
      manifestSha256: sha256,
      modelAliases: ["approved-model-alias-001"],
    },
    backupAndRestore: {
      databaseBackupReference: "DATABASE-BACKUP-001",
      storageBackupReference: "STORAGE-BACKUP-001",
      restoreExerciseReference: "RESTORE-EXERCISE-001",
      restoreExerciseAtUtc: "2026-08-27T11:00:00Z",
    },
    rollback: {
      gitSha: "c".repeat(40),
      vercelDeploymentId: "deployment_rollback_001",
      schemaCompatible: true,
      compatibilityEvidenceReference: "ROLLBACK-COMPATIBILITY-001",
      exerciseEvidenceReference: "ROLLBACK-EXERCISE-001",
    },
    gates,
    knownRisks: [],
    ownerApproval: {
      phase: "production",
      candidateGitSha: candidateSha,
      migrationHead,
      vercelDeploymentId: deploymentId,
      ownerAlias: "owner-001",
      approvedAtUtc: "2026-08-27T12:05:00Z",
      evidenceReference: "OWNER-APPROVAL-001",
    },
    production: {
      gitSha: candidateSha,
      migrationHead,
      vercelDeploymentId: deploymentId,
      promotedAtUtc: "2026-08-27T12:10:00Z",
      outcome: "verified",
      evidenceReference: "PRODUCTION-OUTCOME-001",
    },
    monitoringWindow: {
      startedAtUtc: "2026-08-27T12:10:00Z",
      endedAtUtc: "2026-08-27T12:25:00Z",
      status: "passed",
      evidenceReference: "MONITORING-EVIDENCE-001",
      signals: [
        "web-health",
        "database-health",
        "auth-health",
        "ai-cost-health",
      ],
    },
    ...overrides,
  };
}

describe("production release record verifier", () => {
  it("accepts a complete record bound to one qualified production artifact", () => {
    assert.deepEqual(validateProductionReleaseRecord(record(), "production"), {
      ok: true,
      errors: [],
    });
  });

  it("accepts qualification before production-only evidence exists", () => {
    const value = record({ phase: "qualification" });
    value.ownerApproval.phase = "qualification";
    delete value.production;
    delete value.monitoringWindow;
    assert.equal(
      validateProductionReleaseRecord(value, "qualification").ok,
      true,
    );
  });

  it("rejects artifact drift between qualification, approval, and production", () => {
    const value = record();
    value.production.gitSha = "d".repeat(40);
    value.ownerApproval.vercelDeploymentId = "different_deployment_001";
    const result = validateProductionReleaseRecord(value, "production");
    assert.equal(result.ok, false);
    assert.match(result.errors.join(" "), /exact qualified Git SHA/u);
    assert.match(result.errors.join(" "), /exact candidate deployment/u);
  });

  it("rejects monitoring shorter than 15 minutes", () => {
    const value = record();
    value.monitoringWindow.endedAtUtc = "2026-08-27T12:24:59Z";
    const result = validateProductionReleaseRecord(value, "production");
    assert.equal(result.ok, false);
    assert.match(result.errors.join(" "), /at least 15 minutes/u);
  });

  it("rejects approval or monitoring that occurs on the wrong side of promotion", () => {
    const value = record();
    value.ownerApproval.approvedAtUtc = "2026-08-27T12:11:00Z";
    value.monitoringWindow.startedAtUtc = "2026-08-27T11:30:00Z";
    value.monitoringWindow.endedAtUtc = "2026-08-27T11:45:00Z";
    const result = validateProductionReleaseRecord(value, "production");
    assert.equal(result.ok, false);
    assert.match(result.errors.join(" "), /approval must occur before/u);
    assert.match(result.errors.join(" "), /monitoring must start after/u);
  });

  it("rejects late qualification or restore proof and early Production smoke", () => {
    const value = record();
    value.backupAndRestore.restoreExerciseAtUtc = "2026-08-27T12:11:00Z";
    value.gates.rollbackRehearsal.reviewedAtUtc = "2026-08-27T12:11:00Z";
    value.gates.productionSmoke.reviewedAtUtc = "2026-08-27T12:09:00Z";
    const result = validateProductionReleaseRecord(value, "production");
    assert.equal(result.ok, false);
    assert.match(result.errors.join(" "), /restore exercise/u);
    assert.match(result.errors.join(" "), /rollbackRehearsal/u);
    assert.match(result.errors.join(" "), /smoke evidence/u);
  });

  it("rejects a rollback target without explicit schema compatibility", () => {
    const value = record();
    value.rollback.schemaCompatible = false;
    const result = validateProductionReleaseRecord(value, "production");
    assert.equal(result.ok, false);
    assert.match(result.errors.join(" "), /schema compatibility/u);
  });

  it("rejects incomplete or unevidenced gates", () => {
    const value = record();
    value.gates.authRlsStorage.status = "blocked";
    value.gates.ragEvaluation.evidenceReference = "";
    const result = validateProductionReleaseRecord(value, "production");
    assert.equal(result.ok, false);
    assert.match(result.errors.join(" "), /authRlsStorage/u);
    assert.match(result.errors.join(" "), /ragEvaluation evidence/u);
  });
});
