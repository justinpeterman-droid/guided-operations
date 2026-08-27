import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { validateProductionBackupRequest } from "./production-backup-guard.mjs";

const projectRef = "abcdefghijklmnopqrst";

function input(overrides = {}) {
  return {
    appEnvironment: "production",
    backupEnabled: "true",
    projectRef,
    region: "us-east-1",
    databaseUrl: `postgresql://postgres.${projectRef}:secret@aws-0-us-east-1.pooler.supabase.com:5432/postgres?sslmode=require`,
    supabaseUrl: `https://${projectRef}.supabase.co`,
    supabaseSecretKey: "server-side-secret-placeholder",
    approvalReference: "OWNER-BACKUP-APPROVAL-001",
    ageRecipient:
      "age1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq",
    confirmation: `BACKUP PRODUCTION ${projectRef}`,
    ...overrides,
  };
}

const paths = {
  repositoryRoot: "C:\\workspace\\guided-operations",
  destinationRoot: "D:\\protected-backups",
  targetAttestation: {
    schema_version: 1,
    purpose: "guided-operations-production-backup",
    off_provider: true,
    encrypted_only: true,
    target_id: "OFF-PROVIDER-TARGET-001",
  },
};

describe("production backup request guard", () => {
  it("accepts an exact protected Production backup request", () => {
    assert.deepEqual(validateProductionBackupRequest(input(), paths), {
      ok: true,
      errors: [],
    });
  });

  it("fails closed outside Production or when the external gate is absent", () => {
    const result = validateProductionBackupRequest(
      input({ appEnvironment: "preview", backupEnabled: "" }),
      paths,
    );
    assert.equal(result.ok, false);
    assert.match(result.errors.join(" "), /only for the Production/u);
    assert.match(result.errors.join(" "), /not enabled/u);
  });

  it("rejects target confusion and missing TLS", () => {
    const result = validateProductionBackupRequest(
      input({
        databaseUrl:
          "postgresql://postgres.wrongprojectrefxxxx:secret@aws-0-us-east-1.pooler.supabase.com:5432/postgres?sslmode=disable",
        supabaseUrl: "https://wrongprojectrefxxxx.supabase.co",
      }),
      paths,
    );
    assert.equal(result.ok, false);
    assert.match(result.errors.join(" "), /database URL does not match/u);
    assert.match(result.errors.join(" "), /must require TLS/u);
    assert.match(result.errors.join(" "), /Supabase URL does not match/u);
  });

  it("requires an external destination that cannot contain the repository", () => {
    const result = validateProductionBackupRequest(input(), {
      ...paths,
      destinationRoot: "C:\\workspace",
    });
    assert.equal(result.ok, false);
    assert.match(result.errors.join(" "), /repository cannot be inside/u);
  });

  it("rejects a destination inside the repository", () => {
    const result = validateProductionBackupRequest(input(), {
      ...paths,
      destinationRoot: "C:\\workspace\\guided-operations\\backups",
    });
    assert.equal(result.ok, false);
    assert.match(result.errors.join(" "), /outside the repository/u);
  });

  it("requires a bounded off-provider encrypted-target attestation", () => {
    const result = validateProductionBackupRequest(input(), {
      ...paths,
      targetAttestation: null,
    });
    assert.equal(result.ok, false);
    assert.match(result.errors.join(" "), /off-provider encrypted-target/u);
  });

  it("requires a bounded reference, public encryption recipient, and exact confirmation", () => {
    const result = validateProductionBackupRequest(
      input({
        approvalReference: "bad value with spaces",
        ageRecipient: "not-an-age-recipient",
        confirmation: "BACKUP",
      }),
      paths,
    );
    assert.equal(result.ok, false);
    assert.match(result.errors.join(" "), /approval reference/u);
    assert.match(result.errors.join(" "), /age public recipient/u);
    assert.match(
      result.errors.join(" "),
      /exact Production backup confirmation/u,
    );
  });
});
