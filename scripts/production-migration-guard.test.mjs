import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { validateProductionMigrationRequest } from "./production-migration-guard.mjs";

const candidateSha = "a".repeat(40);
const projectRef = "abcdefghijklmnopqrst";

function input(overrides = {}) {
  return {
    operation: "dry-run",
    candidateSha,
    expectedMigrationHead: "20260827023000",
    projectRef,
    region: "us-east-1",
    databaseUrl: `postgresql://postgres.${projectRef}:secret@aws-0-us-east-1.pooler.supabase.com:5432/postgres?sslmode=require`,
    migrationEnabled: "true",
    approvalReference: "OWNER-APPROVAL-001",
    backupEvidenceReference: "",
    dryRunEvidenceReference: "",
    confirmation: `DRY-RUN ${candidateSha}`,
    ...overrides,
  };
}

function repository(overrides = {}) {
  return {
    currentSha: candidateSha,
    migrationHead: "20260827023000",
    status: "",
    ...overrides,
  };
}

describe("production migration request guard", () => {
  it("accepts an exact dry-run request for the protected target", () => {
    assert.deepEqual(
      validateProductionMigrationRequest(input(), repository()),
      {
        ok: true,
        errors: [],
      },
    );
  });

  it("requires separate dry-run and backup evidence before apply", () => {
    const result = validateProductionMigrationRequest(
      input({ operation: "apply", confirmation: `APPLY ${candidateSha}` }),
      repository(),
    );
    assert.equal(result.ok, false);
    assert.match(result.errors.join(" "), /backup evidence/u);
    assert.match(result.errors.join(" "), /dry-run evidence/u);
  });

  it("accepts apply only with exact evidence and confirmation", () => {
    const result = validateProductionMigrationRequest(
      input({
        operation: "apply",
        confirmation: `APPLY ${candidateSha}`,
        backupEvidenceReference: "BACKUP-EVIDENCE-001",
        dryRunEvidenceReference: "DRY-RUN-EVIDENCE-001",
      }),
      repository(),
    );
    assert.equal(result.ok, true);
  });

  it("rejects the wrong commit, migration head, region, and dirty checkout", () => {
    const result = validateProductionMigrationRequest(
      input({ region: "us-west-1" }),
      repository({
        currentSha: "b".repeat(40),
        migrationHead: "20260827022000",
        status: " M changed.sql",
      }),
    );
    assert.equal(result.ok, false);
    assert.match(result.errors.join(" "), /region/u);
    assert.match(result.errors.join(" "), /checked-out commit/u);
    assert.match(result.errors.join(" "), /migration head/u);
    assert.match(result.errors.join(" "), /clean/u);
  });

  it("rejects a database URL for a different project or disabled TLS", () => {
    const result = validateProductionMigrationRequest(
      input({
        databaseUrl:
          "postgresql://postgres.wrongprojectrefxxxx:secret@aws-0-us-east-1.pooler.supabase.com:5432/postgres?sslmode=disable",
      }),
      repository(),
    );
    assert.equal(result.ok, false);
    assert.match(result.errors.join(" "), /does not match/u);
    assert.match(result.errors.join(" "), /must require TLS/u);
  });

  it("rejects a production database URL that does not explicitly require TLS", () => {
    const result = validateProductionMigrationRequest(
      input({
        databaseUrl: `postgresql://postgres.${projectRef}:secret@aws-0-us-east-1.pooler.supabase.com:5432/postgres`,
      }),
      repository(),
    );
    assert.equal(result.ok, false);
    assert.match(result.errors.join(" "), /must require TLS/u);
  });

  it("fails closed when the external environment gate is absent", () => {
    const result = validateProductionMigrationRequest(
      input({ migrationEnabled: "" }),
      repository(),
    );
    assert.equal(result.ok, false);
    assert.match(result.errors.join(" "), /not enabled/u);
  });
});
