import { execFileSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

const SHA_PATTERN = /^[a-f0-9]{40}$/u;
const MIGRATION_HEAD_PATTERN = /^\d{14}$/u;
const PROJECT_REF_PATTERN = /^[a-z]{20}$/u;
const REFERENCE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:/-]{7,159}$/u;

export function validateProductionMigrationRequest(input, repository) {
  const errors = [];
  const operation = input.operation;
  const candidateSha = input.candidateSha;

  if (!new Set(["dry-run", "apply"]).has(operation))
    errors.push("Operation must be dry-run or apply.");
  if (!SHA_PATTERN.test(candidateSha ?? ""))
    errors.push("Candidate SHA must be a full lowercase Git SHA.");
  if (input.migrationEnabled !== "true")
    errors.push("The protected production migration gate is not enabled.");
  if (!PROJECT_REF_PATTERN.test(input.projectRef ?? ""))
    errors.push("The protected Supabase project reference is invalid.");
  if (input.region !== "us-east-1")
    errors.push("The protected Supabase project region is not approved.");
  if (!MIGRATION_HEAD_PATTERN.test(input.expectedMigrationHead ?? ""))
    errors.push("The expected migration head is invalid.");
  if (!REFERENCE_PATTERN.test(input.approvalReference ?? ""))
    errors.push("A bounded owner approval reference is required.");
  if (repository.currentSha !== candidateSha)
    errors.push(
      "The checked-out commit does not match the approved candidate.",
    );
  if (repository.migrationHead !== input.expectedMigrationHead)
    errors.push("The checked-out migration head does not match the request.");
  if (repository.status !== "")
    errors.push("The candidate checkout must be clean.");

  validateDatabaseUrl(input.databaseUrl, input.projectRef, errors);

  const expectedConfirmation =
    operation === "apply" ? `APPLY ${candidateSha}` : `DRY-RUN ${candidateSha}`;
  if (input.confirmation !== expectedConfirmation)
    errors.push("The exact candidate confirmation is required.");

  if (operation === "apply") {
    if (!REFERENCE_PATTERN.test(input.backupEvidenceReference ?? ""))
      errors.push("Verified database and Storage backup evidence is required.");
    if (!REFERENCE_PATTERN.test(input.dryRunEvidenceReference ?? ""))
      errors.push("An approved dry-run evidence reference is required.");
  }

  return { ok: errors.length === 0, errors };
}

export function readRepositoryEvidence(projectRoot = process.cwd()) {
  const migrations = readdirSync(resolve(projectRoot, "supabase", "migrations"))
    .map((name) => /^(\d{14})_[A-Za-z0-9_-]+\.sql$/u.exec(name)?.[1])
    .filter(Boolean)
    .sort();
  if (migrations.length === 0)
    throw new Error("No versioned database migrations were found.");

  return {
    currentSha: git(projectRoot, ["rev-parse", "HEAD"]),
    migrationHead: migrations.at(-1),
    status: git(projectRoot, [
      "status",
      "--porcelain",
      "--untracked-files=all",
    ]),
  };
}

function validateDatabaseUrl(value, projectRef, errors) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    errors.push("The protected migration database URL is invalid.");
    return;
  }
  if (!new Set(["postgres:", "postgresql:"]).has(parsed.protocol))
    errors.push("The migration target must be PostgreSQL.");
  if (!parsed.password)
    errors.push("The migration database URL must contain a credential.");
  if (new Set(["localhost", "127.0.0.1", "::1"]).has(parsed.hostname))
    errors.push("The production migration job cannot target loopback.");
  const targetMatches =
    parsed.hostname === `db.${projectRef}.supabase.co` ||
    parsed.username === `postgres.${projectRef}`;
  if (!targetMatches)
    errors.push(
      "The migration database URL does not match the protected project.",
    );
  if (
    !new Set(["require", "verify-ca", "verify-full"]).has(
      parsed.searchParams.get("sslmode"),
    )
  )
    errors.push("The migration database connection must require TLS.");
}

function git(projectRoot, args) {
  return execFileSync("git", args, {
    cwd: projectRoot,
    encoding: "utf8",
    windowsHide: true,
  }).trim();
}

function fromEnvironment() {
  return {
    operation: process.env.MIGRATION_OPERATION,
    candidateSha: process.env.MIGRATION_CANDIDATE_SHA,
    expectedMigrationHead: process.env.MIGRATION_EXPECTED_HEAD,
    projectRef: process.env.SUPABASE_PROJECT_REF,
    region: process.env.SUPABASE_PROJECT_REGION,
    databaseUrl: process.env.SUPABASE_MIGRATION_DB_URL,
    migrationEnabled: process.env.PRODUCTION_MIGRATION_ENABLED,
    approvalReference: process.env.MIGRATION_APPROVAL_REFERENCE,
    backupEvidenceReference: process.env.MIGRATION_BACKUP_REFERENCE,
    dryRunEvidenceReference: process.env.MIGRATION_DRY_RUN_EVIDENCE,
    confirmation: process.env.MIGRATION_CONFIRMATION,
  };
}

function main() {
  const result = validateProductionMigrationRequest(
    fromEnvironment(),
    readRepositoryEvidence(),
  );
  if (!result.ok) {
    for (const error of result.errors)
      console.error(`Production migration request rejected: ${error}`);
    process.exit(1);
  }
  console.log(
    "Production migration request validated for the exact candidate.",
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  main();
