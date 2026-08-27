import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";

export function buildProductionMigrationEvidence(input) {
  return {
    evidence_version: 1,
    environment: "production",
    operation: input.operation,
    result: input.result,
    candidate_sha: input.candidateSha,
    candidate_migration_head: input.expectedMigrationHead,
    project_reference_sha256: sha256(Buffer.from(input.projectRef, "utf8")),
    region: input.region,
    approval_reference: input.approvalReference,
    backup_evidence_reference:
      input.operation === "apply" ? input.backupEvidenceReference : null,
    dry_run_evidence_reference:
      input.operation === "apply" ? input.dryRunEvidenceReference : null,
    workflow: {
      repository: input.repository,
      run_id: input.runId,
      run_attempt: input.runAttempt,
    },
    command_evidence: Object.fromEntries(
      Object.entries(input.files).map(([label, filePath]) => [
        label,
        fileDigest(filePath),
      ]),
    ),
    started_at: input.startedAt,
    completed_at: input.completedAt,
    limitations: [
      "Value-free workflow evidence; command output and credentials are not retained.",
      "A successful dry-run does not authorize apply or production traffic.",
      "An apply result still requires post-migration application qualification and owner acceptance.",
    ],
  };
}

function fileDigest(filePath) {
  if (!filePath || !existsSync(filePath)) return null;
  const bytes = readFileSync(filePath);
  return { bytes: bytes.length, sha256: sha256(bytes) };
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required evidence field: ${name}`);
  return value;
}

function main() {
  const projectRoot = process.cwd();
  const evidenceRoot = resolve(projectRoot, "test-results");
  const evidencePath = resolve(
    projectRoot,
    "test-results",
    "production-migration-evidence.json",
  );
  if (!evidencePath.startsWith(`${evidenceRoot}${sep}`))
    throw new Error("Production migration evidence path escaped test-results.");

  const commandRoot = required("MIGRATION_COMMAND_EVIDENCE_DIR");
  const evidence = buildProductionMigrationEvidence({
    operation: required("MIGRATION_OPERATION"),
    result: required("MIGRATION_RESULT"),
    candidateSha: required("MIGRATION_CANDIDATE_SHA"),
    expectedMigrationHead: required("MIGRATION_EXPECTED_HEAD"),
    projectRef: required("SUPABASE_PROJECT_REF"),
    region: required("SUPABASE_PROJECT_REGION"),
    approvalReference: required("MIGRATION_APPROVAL_REFERENCE"),
    backupEvidenceReference: process.env.MIGRATION_BACKUP_REFERENCE ?? "",
    dryRunEvidenceReference: process.env.MIGRATION_DRY_RUN_EVIDENCE ?? "",
    repository: required("GITHUB_REPOSITORY"),
    runId: required("GITHUB_RUN_ID"),
    runAttempt: required("GITHUB_RUN_ATTEMPT"),
    startedAt: required("MIGRATION_STARTED_AT"),
    completedAt: new Date().toISOString(),
    files: {
      migration_history_before: resolve(commandRoot, "history-before.json"),
      dry_run: resolve(commandRoot, "dry-run.txt"),
      apply: resolve(commandRoot, "apply.txt"),
      migration_history_after: resolve(commandRoot, "history-after.json"),
    },
  });
  mkdirSync(dirname(evidencePath), { recursive: true });
  writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  console.log("Bounded production migration evidence written.");
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    main();
  } catch (error) {
    console.error(
      error instanceof Error
        ? error.message
        : "Unable to write production migration evidence.",
    );
    process.exit(1);
  }
}
