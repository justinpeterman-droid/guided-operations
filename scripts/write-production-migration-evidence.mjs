import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";

export function buildProductionMigrationEvidence(input) {
  const operation = allowed(input.operation, ["dry-run", "apply"]);
  return {
    evidence_version: 1,
    environment: "production",
    operation,
    result: allowed(input.result, [
      "success",
      "failure",
      "cancelled",
      "skipped",
    ]),
    candidate_sha: matches(input.candidateSha, /^[a-f0-9]{40}$/u),
    candidate_migration_head: matches(input.expectedMigrationHead, /^\d{14}$/u),
    project_reference_sha256: projectReferenceDigest(input.projectRef),
    region: allowed(input.region, ["us-east-1"]),
    approval_reference: boundedReference(input.approvalReference),
    backup_evidence_reference:
      operation === "apply"
        ? boundedReference(input.backupEvidenceReference)
        : null,
    dry_run_evidence_reference:
      operation === "apply"
        ? boundedReference(input.dryRunEvidenceReference)
        : null,
    workflow: {
      repository: matches(
        input.repository,
        /^[A-Za-z0-9_.-]{1,100}\/[A-Za-z0-9_.-]{1,100}$/u,
      ),
      run_id: matches(input.runId, /^\d{1,20}$/u),
      run_attempt: matches(input.runAttempt, /^\d{1,6}$/u),
    },
    command_evidence: Object.fromEntries(
      [
        "migration_history_before",
        "dry_run",
        "apply",
        "migration_history_after",
      ].map((label) => [label, fileDigest(input.files?.[label])]),
    ),
    started_at: utcTimestamp(input.startedAt),
    completed_at: utcTimestamp(input.completedAt),
    limitations: [
      "Value-free workflow evidence; command output and credentials are not retained.",
      "A successful dry-run does not authorize apply or production traffic.",
      "An apply result still requires post-migration application qualification and owner acceptance.",
    ],
  };
}

function allowed(value, values) {
  return typeof value === "string" && values.includes(value) ? value : null;
}

function matches(value, pattern) {
  return typeof value === "string" && pattern.test(value) ? value : null;
}

function boundedReference(value) {
  return matches(value, /^[A-Za-z0-9][A-Za-z0-9._:/-]{7,159}$/u);
}

function projectReferenceDigest(value) {
  const projectRef = matches(value, /^[a-z]{20}$/u);
  return projectRef ? sha256(Buffer.from(projectRef, "utf8")) : null;
}

function utcTimestamp(value) {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/u.test(value)
  )
    return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf()) ? null : value;
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
