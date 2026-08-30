import { readFileSync, realpathSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const PROJECT_REF_PATTERN = /^[a-z]{20}$/u;
const REFERENCE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:/-]{7,159}$/u;
const AGE_RECIPIENT_PATTERN = /^age1[0-9a-z]{20,100}$/u;

export function validateProductionBackupRequest(input, paths) {
  const errors = [];

  if (input.appEnvironment !== "production")
    errors.push("The backup tool runs only for the Production environment.");
  if (input.backupEnabled !== "true")
    errors.push("The protected Production backup gate is not enabled.");
  if (!PROJECT_REF_PATTERN.test(input.projectRef ?? ""))
    errors.push("The protected Supabase project reference is invalid.");
  if (input.region !== "us-east-1")
    errors.push("The protected Supabase project region is not approved.");
  if (!REFERENCE_PATTERN.test(input.approvalReference ?? ""))
    errors.push("A bounded backup approval reference is required.");
  if (!AGE_RECIPIENT_PATTERN.test(input.ageRecipient ?? ""))
    errors.push("A valid age public recipient is required.");
  if (!input.supabaseSecretKey)
    errors.push(
      "A dedicated server-side Storage backup credential is required.",
    );

  validateDatabaseUrl(input.databaseUrl, input.projectRef, errors);
  validateSupabaseUrl(input.supabaseUrl, input.projectRef, errors);
  validateDestination(paths, errors);

  const expectedConfirmation = `BACKUP PRODUCTION ${input.projectRef}`;
  if (input.confirmation !== expectedConfirmation)
    errors.push("The exact Production backup confirmation is required.");

  return { ok: errors.length === 0, errors };
}

export function resolveBackupPaths({ repositoryRoot, destinationRoot }) {
  if (!isAbsolute(repositoryRoot ?? ""))
    throw new Error("The repository root must be absolute.");
  if (!isAbsolute(destinationRoot ?? ""))
    throw new Error("The backup destination must be an absolute path.");

  const resolvedDestination = realpathSync(resolve(destinationRoot));
  let targetAttestation = null;
  try {
    targetAttestation = JSON.parse(
      readFileSync(
        resolve(resolvedDestination, ".guided-operations-backup-target.json"),
        "utf8",
      ),
    );
  } catch {
    targetAttestation = null;
  }

  return {
    repositoryRoot: realpathSync(resolve(repositoryRoot)),
    destinationRoot: resolvedDestination,
    targetAttestation,
  };
}

function validateDestination(paths, errors) {
  if (!paths?.repositoryRoot || !paths?.destinationRoot) {
    errors.push("The protected backup destination could not be verified.");
    return;
  }

  const attestation = paths.targetAttestation;
  if (
    attestation?.schema_version !== 1 ||
    attestation?.purpose !== "guided-operations-production-backup" ||
    attestation?.off_provider !== true ||
    attestation?.encrypted_only !== true ||
    !REFERENCE_PATTERN.test(attestation?.target_id ?? "")
  )
    errors.push(
      "The destination lacks a valid off-provider encrypted-target attestation.",
    );

  const repositoryRoot = resolve(paths.repositoryRoot);
  const destinationRoot = resolve(paths.destinationRoot);
  const fromRepository = relative(repositoryRoot, destinationRoot);
  const fromDestination = relative(destinationRoot, repositoryRoot);

  if (
    fromRepository === "" ||
    (!fromRepository.startsWith("..") && !isAbsolute(fromRepository))
  )
    errors.push("The backup destination must be outside the repository.");
  if (
    fromDestination === "" ||
    (!fromDestination.startsWith("..") && !isAbsolute(fromDestination))
  )
    errors.push("The repository cannot be inside the backup destination.");
}

function validateSupabaseUrl(value, projectRef, errors) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    errors.push("The protected Supabase URL is invalid.");
    return;
  }
  if (parsed.protocol !== "https:")
    errors.push("The protected Supabase URL must use HTTPS.");
  if (parsed.hostname !== `${projectRef}.supabase.co`)
    errors.push("The protected Supabase URL does not match the project.");
  if (parsed.pathname !== "/" || parsed.search || parsed.hash)
    errors.push("The protected Supabase URL must be the project origin only.");
}

function validateDatabaseUrl(value, projectRef, errors) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    errors.push("The protected backup database URL is invalid.");
    return;
  }
  if (!new Set(["postgres:", "postgresql:"]).has(parsed.protocol))
    errors.push("The backup database target must be PostgreSQL.");
  if (!parsed.password)
    errors.push("The backup database URL must contain a credential.");
  if (new Set(["localhost", "127.0.0.1", "::1"]).has(parsed.hostname))
    errors.push("The Production backup tool cannot target loopback.");
  const targetMatches =
    parsed.hostname === `db.${projectRef}.supabase.co` ||
    parsed.username === `postgres.${projectRef}`;
  if (!targetMatches)
    errors.push(
      "The backup database URL does not match the protected project.",
    );
  if (
    !new Set(["require", "verify-ca", "verify-full"]).has(
      parsed.searchParams.get("sslmode"),
    )
  )
    errors.push("The backup database connection must require TLS.");
}

function fromEnvironment() {
  return {
    appEnvironment: process.env.APP_ENV,
    backupEnabled: process.env.PRODUCTION_BACKUP_ENABLED,
    projectRef: process.env.SUPABASE_PROJECT_REF,
    region: process.env.SUPABASE_PROJECT_REGION,
    databaseUrl: process.env.PRODUCTION_BACKUP_DB_URL,
    supabaseUrl: process.env.PRODUCTION_BACKUP_SUPABASE_URL,
    supabaseSecretKey: process.env.PRODUCTION_BACKUP_STORAGE_KEY,
    approvalReference: process.env.PRODUCTION_BACKUP_APPROVAL_REFERENCE,
    ageRecipient: process.env.PRODUCTION_BACKUP_AGE_RECIPIENT,
    confirmation: process.env.PRODUCTION_BACKUP_CONFIRMATION,
  };
}

function main() {
  let paths;
  try {
    paths = resolveBackupPaths({
      repositoryRoot: process.cwd(),
      destinationRoot: process.env.PRODUCTION_BACKUP_DESTINATION,
    });
  } catch {
    paths = null;
  }
  const result = validateProductionBackupRequest(fromEnvironment(), paths);
  if (!result.ok) {
    for (const error of result.errors)
      console.error(`Production backup request rejected: ${error}`);
    process.exit(1);
  }
  console.log("Production backup request validated for the protected target.");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  main();
