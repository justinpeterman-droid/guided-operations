import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const SHA_PATTERN = /^[a-f0-9]{40}$/u;
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const MIGRATION_PATTERN = /^\d{14}$/u;
const IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{7,159}$/u;
const REFERENCE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:/#-]{7,500}$/u;
const REGION_PATTERN = /^[a-z]{2}-[a-z]+-\d$/u;
const REQUIRED_QUALIFICATION_GATES = [
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
];
const REQUIRED_PRODUCTION_GATES = [
  "productionMigration",
  "productionSmoke",
  "productionAuthorization",
];

export function validateProductionReleaseRecord(record, requiredPhase) {
  const errors = [];

  if (!record || typeof record !== "object" || Array.isArray(record))
    return { ok: false, errors: ["The release record must be a JSON object."] };

  if (record.schemaVersion !== 1) errors.push("Schema version must be 1.");
  if (!new Set(["qualification", "production"]).has(requiredPhase))
    errors.push("Required phase must be qualification or production.");
  if (record.phase !== requiredPhase)
    errors.push("The record phase does not match the requested verification.");
  if (!IDENTIFIER_PATTERN.test(record.releaseId ?? ""))
    errors.push("A bounded release identifier is required.");
  if (!isUtc(record.createdAtUtc))
    errors.push("A valid UTC creation timestamp is required.");

  const candidate = object(record.candidate);
  if (!SHA_PATTERN.test(candidate.gitSha ?? ""))
    errors.push("Candidate Git SHA must be a full lowercase SHA.");
  if (!MIGRATION_PATTERN.test(candidate.migrationHead ?? ""))
    errors.push("Candidate migration head must be a 14-digit version.");
  if (!IDENTIFIER_PATTERN.test(candidate.vercelDeploymentId ?? ""))
    errors.push("Candidate Vercel deployment identifier is required.");
  validateHttps(
    candidate.vercelDeploymentUrl,
    "Candidate deployment URL",
    errors,
  );
  if (!IDENTIFIER_PATTERN.test(candidate.configurationVersion ?? ""))
    errors.push("A non-secret configuration version is required.");
  validateReferences(
    candidate.pullRequests,
    "reviewed pull request",
    errors,
    true,
  );

  const environment = object(record.environment);
  if (!IDENTIFIER_PATTERN.test(environment.supabaseProjectAlias ?? ""))
    errors.push("A non-secret Supabase project alias is required.");
  if (!SHA256_PATTERN.test(environment.supabaseProjectRefSha256 ?? ""))
    errors.push(
      "A SHA-256 digest of the Supabase project reference is required.",
    );
  if (!REGION_PATTERN.test(environment.region ?? ""))
    errors.push("A bounded provider region is required.");
  if (!IDENTIFIER_PATTERN.test(environment.vercelProjectAlias ?? ""))
    errors.push("A non-secret Vercel project alias is required.");

  const corpus = object(record.corpus);
  if (!IDENTIFIER_PATTERN.test(corpus.manifestVersion ?? ""))
    errors.push("An approved corpus manifest version is required.");
  if (!SHA256_PATTERN.test(corpus.manifestSha256 ?? ""))
    errors.push("The corpus manifest SHA-256 is required.");
  validateReferences(corpus.modelAliases, "AI model alias", errors, false);

  const backup = object(record.backupAndRestore);
  validateReference(backup.databaseBackupReference, "Database backup", errors);
  validateReference(backup.storageBackupReference, "Storage backup", errors);
  validateReference(
    backup.restoreExerciseReference,
    "Restore exercise",
    errors,
  );
  if (!isUtc(backup.restoreExerciseAtUtc))
    errors.push("A valid restore exercise UTC timestamp is required.");

  const rollback = object(record.rollback);
  if (!SHA_PATTERN.test(rollback.gitSha ?? ""))
    errors.push("Rollback Git SHA must be a full lowercase SHA.");
  if (!IDENTIFIER_PATTERN.test(rollback.vercelDeploymentId ?? ""))
    errors.push("Rollback Vercel deployment identifier is required.");
  if (rollback.schemaCompatible !== true)
    errors.push("Rollback schema compatibility must be explicitly true.");
  validateReference(
    rollback.compatibilityEvidenceReference,
    "Rollback compatibility",
    errors,
  );
  validateReference(
    rollback.exerciseEvidenceReference,
    "Rollback exercise",
    errors,
  );

  validateGates(record.gates, requiredPhase, errors);
  validateRisks(record.knownRisks, errors);
  validateApproval(record.ownerApproval, candidate, requiredPhase, errors);

  if (requiredPhase === "production") {
    validateProduction(record.production, candidate, errors);
    validateMonitoring(record.monitoringWindow, errors);
  }

  return { ok: errors.length === 0, errors };
}

function validateGates(value, requiredPhase, errors) {
  const gates = object(value);
  const required = [
    ...REQUIRED_QUALIFICATION_GATES,
    ...(requiredPhase === "production" ? REQUIRED_PRODUCTION_GATES : []),
  ];
  for (const name of required) {
    const gate = object(gates[name]);
    const ownerGate = new Set([
      "ownerProductAcceptance",
      "productionAuthorization",
    ]).has(name);
    const acceptedStatuses = new Set(
      ownerGate ? ["passed", "owner-accepted"] : ["passed"],
    );
    if (!acceptedStatuses.has(gate.status))
      errors.push(`Gate ${name} does not have an accepted disposition.`);
    validateReference(gate.evidenceReference, `Gate ${name} evidence`, errors);
    if (!isUtc(gate.reviewedAtUtc))
      errors.push(`Gate ${name} requires a valid UTC review timestamp.`);
    if (!IDENTIFIER_PATTERN.test(gate.reviewer ?? ""))
      errors.push(`Gate ${name} requires a bounded reviewer alias.`);
  }
}

function validateRisks(value, errors) {
  if (!Array.isArray(value)) {
    errors.push(
      "Known risks must be an array, including an empty array when none remain.",
    );
    return;
  }
  for (const risk of value) {
    if (!IDENTIFIER_PATTERN.test(risk?.id ?? ""))
      errors.push("Each known risk requires a bounded identifier.");
    if (!validText(risk?.summary, 12, 300))
      errors.push("Each known risk requires a bounded summary.");
    if (!new Set(["resolved", "owner-accepted"]).has(risk?.disposition))
      errors.push("Each known risk requires an approved disposition.");
    validateReference(risk?.evidenceReference, "Known risk evidence", errors);
  }
}

function validateApproval(value, candidate, phase, errors) {
  const approval = object(value);
  if (approval.phase !== phase)
    errors.push("Owner approval must name the verified phase.");
  if (approval.candidateGitSha !== candidate.gitSha)
    errors.push("Owner approval must bind the exact candidate Git SHA.");
  if (approval.migrationHead !== candidate.migrationHead)
    errors.push("Owner approval must bind the exact migration head.");
  if (approval.vercelDeploymentId !== candidate.vercelDeploymentId)
    errors.push("Owner approval must bind the exact candidate deployment.");
  if (!IDENTIFIER_PATTERN.test(approval.ownerAlias ?? ""))
    errors.push("Owner approval requires a bounded owner alias.");
  if (!isUtc(approval.approvedAtUtc))
    errors.push("Owner approval requires a valid UTC timestamp.");
  validateReference(approval.evidenceReference, "Owner approval", errors);
}

function validateProduction(value, candidate, errors) {
  const production = object(value);
  if (production.gitSha !== candidate.gitSha)
    errors.push("Production must use the exact qualified Git SHA.");
  if (production.migrationHead !== candidate.migrationHead)
    errors.push("Production must use the exact qualified migration head.");
  if (production.vercelDeploymentId !== candidate.vercelDeploymentId)
    errors.push("Production must use the exact qualified Vercel deployment.");
  if (!isUtc(production.promotedAtUtc))
    errors.push("Production promotion requires a valid UTC timestamp.");
  if (production.outcome !== "verified")
    errors.push(
      "Production outcome must be verified before the release can pass.",
    );
  validateReference(production.evidenceReference, "Production outcome", errors);
}

function validateMonitoring(value, errors) {
  const window = object(value);
  if (!isUtc(window.startedAtUtc) || !isUtc(window.endedAtUtc)) {
    errors.push(
      "Production monitoring requires valid UTC start and end timestamps.",
    );
    return;
  }
  const duration =
    Date.parse(window.endedAtUtc) - Date.parse(window.startedAtUtc);
  if (duration < 15 * 60 * 1000)
    errors.push("Production monitoring must cover at least 15 minutes.");
  if (window.status !== "passed")
    errors.push("Production monitoring must pass before verification.");
  validateReference(window.evidenceReference, "Production monitoring", errors);
  if (!Array.isArray(window.signals) || window.signals.length === 0)
    errors.push("Production monitoring must list the observed signal groups.");
  else
    for (const signal of window.signals)
      if (!IDENTIFIER_PATTERN.test(signal ?? ""))
        errors.push(
          "Production monitoring signal names must be bounded aliases.",
        );
}

function validateReferences(value, label, errors, requireHttps) {
  if (!Array.isArray(value) || value.length === 0) {
    errors.push(`At least one ${label} is required.`);
    return;
  }
  for (const item of value) {
    if (requireHttps) validateHttps(item, label, errors);
    else validateReference(item, label, errors);
  }
}

function validateReference(value, label, errors) {
  if (!REFERENCE_PATTERN.test(value ?? ""))
    errors.push(`${label} reference is missing or invalid.`);
}

function validateHttps(value, label, errors) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.search)
      throw new Error("invalid URL");
  } catch {
    errors.push(
      `${label} must be an HTTPS URL without credentials or query values.`,
    );
  }
}

function isUtc(value) {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/u.test(value) &&
    Number.isFinite(Date.parse(value))
  );
}

function validText(value, min, max) {
  return (
    typeof value === "string" && value.length >= min && value.length <= max
  );
}

function object(value) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : {};
}

function parseArguments(argv) {
  const phaseIndex = argv.indexOf("--phase");
  const fileIndex = argv.indexOf("--file");
  return {
    phase: phaseIndex >= 0 ? argv[phaseIndex + 1] : undefined,
    file: fileIndex >= 0 ? argv[fileIndex + 1] : undefined,
  };
}

function assertPrivateEvidencePath(file, projectRoot) {
  const absoluteFile = resolve(projectRoot, file);
  const tracked = execFileSync(
    "git",
    ["ls-files", "--error-unmatch", absoluteFile],
    {
      cwd: projectRoot,
      encoding: "utf8",
      windowsHide: true,
      stdio: "ignore",
    },
  );
  if (tracked !== undefined)
    throw new Error("Production release evidence must not be tracked by Git.");
}

function main() {
  const { phase, file } = parseArguments(process.argv.slice(2));
  if (!phase || !file) {
    console.error(
      "Usage: npm run release:verify -- --phase qualification|production --file <private-json-path>",
    );
    process.exit(1);
  }

  const projectRoot = process.cwd();
  const absoluteFile = isAbsolute(file) ? file : resolve(projectRoot, file);
  try {
    assertPrivateEvidencePath(absoluteFile, projectRoot);
  } catch (error) {
    if (error?.status !== 1) {
      console.error(
        error instanceof Error
          ? error.message
          : "Release evidence path validation failed.",
      );
      process.exit(1);
    }
  }

  let record;
  try {
    record = JSON.parse(readFileSync(absoluteFile, "utf8"));
  } catch {
    console.error("Release record could not be read as JSON.");
    process.exit(1);
  }
  const result = validateProductionReleaseRecord(record, phase);
  if (!result.ok) {
    for (const error of result.errors)
      console.error(`Release record rejected: ${error}`);
    process.exit(1);
  }
  console.log(`Release record passed the ${phase} proof requirements.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  main();
