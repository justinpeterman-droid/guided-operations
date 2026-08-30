import { spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import {
  mkdirSync,
  mkdtempSync,
  existsSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, relative, resolve, sep } from "node:path";

const confirmation = "--confirm-local-guided-operations";
const projectRoot = process.cwd();
const packageJson = JSON.parse(
  readFileSync(resolve(projectRoot, "package.json"), "utf8"),
);

if (packageJson.name !== "guided-operations") {
  fail("Run this rehearsal from the Guided Operations repository root.");
}

if (!process.argv.includes(confirmation)) {
  fail(`Local target confirmation is required: ${confirmation}`);
}

const runId = randomUUID().replaceAll("-", "");
const startedAt = new Date();
const evidenceRoot = resolve(projectRoot, "test-results");
const evidencePath = resolveEvidencePath();
const tempRoot = mkdtempSync(resolve(tmpdir(), "guided-operations-recovery-"));
rmSync(evidencePath, { force: true });
const databaseContainer = "supabase_db_guided-operations";
const sourceDatabase = "postgres";
const restoreDatabase = `guided_operations_restore_${runId.slice(0, 12)}`;
const containerDumpPath = `/tmp/guided-operations-${runId}.dump`;
const containerRestorePath = `/tmp/guided-operations-${runId}-restore.dump`;
const localDumpPath = resolve(tempRoot, "database.dump");
const storageManifestPath = resolve(tempRoot, "storage-manifest.json");
const sourceFixtureKey = `fictional/recovery-rehearsal/${runId}/qualification.txt`;
const restoreBucket = `recovery-${runId.slice(0, 24)}`;
const windowsSupabaseEntrypoint = process.env.APPDATA
  ? resolve(
      process.env.APPDATA,
      "npm",
      "node_modules",
      "supabase",
      "dist",
      "supabase.js",
    )
  : "";
const supabaseCommand =
  process.platform === "win32" && existsSync(windowsSupabaseEntrypoint)
    ? { program: process.execPath, prefix: [windowsSupabaseEntrypoint] }
    : { program: "supabase", prefix: [] };
const cleanupTasks = [];

let status;
let serviceRoleKey;
let apiUrl;
let sourceFixtureCreated = false;
let restoreBucketCreated = false;
let restoreDatabaseCreated = false;
let successfulEvidence;

try {
  status = JSON.parse(
    run(
      supabaseCommand.program,
      [...supabaseCommand.prefix, "status", "-o", "json"],
      "read local Supabase status",
    ),
  );
  apiUrl = requireLoopbackUrl(status.API_URL, "Supabase API");
  requireLoopbackUrl(status.DB_URL, "Supabase database");
  serviceRoleKey = status.SERVICE_ROLE_KEY;
  if (typeof serviceRoleKey !== "string" || serviceRoleKey.length < 20) {
    throw new Error("The local Supabase service identity is unavailable.");
  }

  const running = run(
    "docker",
    ["inspect", "--format", "{{.State.Running}}", databaseContainer],
    "verify the local database container",
  ).trim();
  if (running !== "true") {
    throw new Error(
      "The local Guided Operations database container is not running.",
    );
  }

  await uploadObject(
    "policy-sources",
    sourceFixtureKey,
    Buffer.from(`Fictional recovery qualification ${runId}`, "utf8"),
    "text/plain",
  );
  sourceFixtureCreated = true;

  const sourceDatabaseFingerprint = databaseFingerprint(
    sourceDatabase,
    "postgres",
  );

  run(
    "docker",
    [
      "exec",
      databaseContainer,
      "pg_dump",
      "-U",
      "postgres",
      "-d",
      sourceDatabase,
      "--format=custom",
      "--no-owner",
      "--no-privileges",
      `--file=${containerDumpPath}`,
    ],
    "create the local database backup",
  );
  cleanupTasks.push(() => removeContainerFiles());
  run(
    "docker",
    ["cp", `${databaseContainer}:${containerDumpPath}`, localDumpPath],
    "copy the local database backup",
  );

  const dumpBytes = readFileSync(localDumpPath);
  if (dumpBytes.length === 0) {
    throw new Error("The local database backup is empty.");
  }
  const dumpSha256 = sha256(dumpBytes);

  const storageBackup = await backUpStorage();
  writeFileSync(
    storageManifestPath,
    `${JSON.stringify(storageBackup.manifest, null, 2)}\n`,
    "utf8",
  );
  const storageManifestSha256 = sha256(readFileSync(storageManifestPath));

  run(
    "docker",
    [
      "exec",
      databaseContainer,
      "createdb",
      "-U",
      "supabase_admin",
      "-T",
      "template0",
      restoreDatabase,
    ],
    "create the isolated local restore database",
  );
  restoreDatabaseCreated = true;
  cleanupTasks.push(() => dropRestoreDatabase());
  run(
    "docker",
    ["cp", localDumpPath, `${databaseContainer}:${containerRestorePath}`],
    "stage the database backup for restore",
  );
  run(
    "docker",
    [
      "exec",
      databaseContainer,
      "pg_restore",
      "-U",
      "supabase_admin",
      "--dbname",
      restoreDatabase,
      "--exit-on-error",
      "--no-owner",
      "--no-privileges",
      containerRestorePath,
    ],
    "restore the database backup",
  );

  const restoredDatabaseFingerprint = databaseFingerprint(
    restoreDatabase,
    "supabase_admin",
  );
  if (
    stableJson(sourceDatabaseFingerprint) !==
    stableJson(restoredDatabaseFingerprint)
  ) {
    throw new Error(
      "The restored database counts do not match the source snapshot.",
    );
  }

  await createRestoreBucket();
  restoreBucketCreated = true;
  cleanupTasks.push(() => removeRestoreBucket());
  const restoredStorage = await restoreAndVerifyStorage(storageBackup.manifest);
  if (storageBackup.aggregateSha256 !== restoredStorage.aggregateSha256) {
    throw new Error("The restored Storage checksums do not match the backup.");
  }

  const completedAt = new Date();
  successfulEvidence = {
    evidence_version: 1,
    rehearsal_id: runId,
    environment: "local-fictional-only",
    source_project: "guided-operations-local",
    database: {
      archive_bytes: dumpBytes.length,
      archive_sha256: dumpSha256,
      source_fingerprint: sourceDatabaseFingerprint,
      restored_fingerprint: restoredDatabaseFingerprint,
      restored_to_isolated_database: true,
    },
    storage: {
      source: storageBackup.aggregates,
      restored: restoredStorage.aggregates,
      aggregate_sha256: storageBackup.aggregateSha256,
      manifest_sha256: storageManifestSha256,
      restored_to_temporary_private_bucket: true,
    },
    started_at: startedAt.toISOString(),
    completed_at: completedAt.toISOString(),
    elapsed_seconds: Number(
      ((completedAt.getTime() - startedAt.getTime()) / 1000).toFixed(3),
    ),
    result: "pass",
    limitations: [
      "Local fictional-data rehearsal only.",
      "Temporary database is isolated within the same local PostgreSQL container.",
      "Storage restore uses a temporary private bucket in the same local Supabase stack.",
      "This does not prove encrypted off-provider backup or hosted-project recovery.",
    ],
  };
} catch (error) {
  const message = error instanceof Error ? error.message : "Unknown failure.";
  console.error(`Local recovery rehearsal failed: ${message}`);
  process.exitCode = 1;
} finally {
  if (sourceFixtureCreated) {
    cleanupTasks.push(() =>
      removeObjects("policy-sources", [sourceFixtureKey]),
    );
  }

  const cleanupFailures = [];
  for (const cleanup of cleanupTasks.reverse()) {
    try {
      await cleanup();
    } catch {
      cleanupFailures.push("cleanup step failed");
    }
  }

  if (restoreBucketCreated) {
    try {
      await removeRestoreBucket();
    } catch {
      cleanupFailures.push("restore bucket cleanup failed");
    }
  }
  if (restoreDatabaseCreated) {
    try {
      dropRestoreDatabase();
    } catch {
      cleanupFailures.push("restore database cleanup failed");
    }
  }
  try {
    removeContainerFiles();
  } catch {
    cleanupFailures.push("container file cleanup failed");
  }

  const relativeTempPath = relative(tmpdir(), tempRoot);
  if (
    relativeTempPath.startsWith("..") ||
    relativeTempPath === "" ||
    !relativeTempPath.startsWith("guided-operations-recovery-")
  ) {
    cleanupFailures.push("temporary directory safety check failed");
  } else {
    rmSync(tempRoot, { recursive: true, force: true });
  }

  if (cleanupFailures.length > 0) {
    console.error("Local recovery rehearsal cleanup was incomplete.");
    process.exitCode = 1;
  }
}

if (process.exitCode !== 1 && successfulEvidence) {
  mkdirSync(dirname(evidencePath), { recursive: true });
  writeFileSync(
    evidencePath,
    `${JSON.stringify(successfulEvidence, null, 2)}\n`,
    "utf8",
  );
  console.log(
    `Local recovery rehearsal passed: ${relative(projectRoot, evidencePath)}`,
  );
  console.log(
    `Database tables reconciled: ${Object.keys(successfulEvidence.database.source_fingerprint.app_private_tables).length}`,
  );
  console.log(
    `Storage objects reconciled: ${successfulEvidence.storage.source.total_objects}`,
  );
}

function resolveEvidencePath() {
  const argument = process.argv.find((value) =>
    value.startsWith("--evidence="),
  );
  const requested = argument
    ? argument.slice("--evidence=".length)
    : "test-results/recovery-rehearsal.json";
  const resolved = resolve(projectRoot, requested);
  if (
    resolved !== evidenceRoot &&
    !resolved.startsWith(`${evidenceRoot}${sep}`)
  ) {
    fail("Recovery evidence must stay under test-results/.");
  }
  return resolved;
}

function run(program, args, operation) {
  const result = spawnSync(program, args, {
    cwd: projectRoot,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
    windowsHide: true,
  });
  if (result.error || result.status !== 0) {
    throw new Error(`${operation} failed.`);
  }
  return result.stdout;
}

function requireLoopbackUrl(value, label) {
  if (typeof value !== "string") {
    throw new Error(`${label} is unavailable.`);
  }
  const parsed = new URL(value);
  if (!new Set(["127.0.0.1", "localhost", "::1"]).has(parsed.hostname)) {
    throw new Error(`${label} is not a loopback-only target.`);
  }
  return parsed.origin;
}

function databaseFingerprint(databaseName, databaseUser) {
  const sql = `
    create temp table recovery_counts (
      table_name text primary key,
      row_count bigint not null
    );
    do $recovery$
    declare
      item record;
      item_count bigint;
    begin
      for item in
        select tablename
        from pg_catalog.pg_tables
        where schemaname = 'app_private'
        order by tablename
      loop
        execute format('select count(*) from app_private.%I', item.tablename)
          into item_count;
        insert into recovery_counts (table_name, row_count)
        values (item.tablename, item_count);
      end loop;
    end
    $recovery$;
    select jsonb_build_object(
      'postgres_major', current_setting('server_version_num')::integer / 10000,
      'migration_head', coalesce(
        (select max(version::text) from supabase_migrations.schema_migrations),
        ''
      ),
      'app_private_tables', coalesce(
        (select jsonb_object_agg(table_name, row_count order by table_name)
         from recovery_counts),
        '{}'::jsonb
      ),
      'auth_users', (select count(*) from auth.users),
      'storage_buckets', (select count(*) from storage.buckets),
      'storage_objects', (select count(*) from storage.objects)
    )::text;
  `;
  const output = run(
    "docker",
    [
      "exec",
      databaseContainer,
      "psql",
      "-U",
      databaseUser,
      "-d",
      databaseName,
      "-Atq",
      "-v",
      "ON_ERROR_STOP=1",
      "-c",
      sql,
    ],
    "read a database reconciliation fingerprint",
  );
  const jsonLine = output
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean)
    .at(-1);
  if (!jsonLine) throw new Error("The database fingerprint was empty.");
  return JSON.parse(jsonLine);
}

async function backUpStorage() {
  const buckets = ["generated-exports", "policy-sources"];
  const manifest = [];

  for (const bucket of buckets) {
    const objects = await listObjects(bucket);
    for (const object of objects) {
      const bytes = await downloadObject(bucket, object.key);
      const backupFile = resolve(
        tempRoot,
        "storage",
        sha256(Buffer.from(`${bucket}:${object.key}`, "utf8")),
      );
      mkdirSync(dirname(backupFile), { recursive: true });
      writeFileSync(backupFile, bytes);
      manifest.push({
        bucket,
        key: object.key,
        backup_file: backupFile,
        byte_size: bytes.length,
        media_type: object.mediaType,
        created_at: object.createdAt,
        updated_at: object.updatedAt,
        sha256: sha256(bytes),
      });
    }
  }

  manifest.sort((left, right) =>
    `${left.bucket}:${left.key}`.localeCompare(`${right.bucket}:${right.key}`),
  );
  return {
    manifest,
    aggregates: storageAggregates(manifest),
    aggregateSha256: storageAggregateSha256(manifest),
  };
}

async function listObjects(bucket) {
  const found = [];
  const prefixes = [""];

  while (prefixes.length > 0) {
    const prefix = prefixes.shift();
    let offset = 0;
    while (true) {
      const response = await storageRequest(
        `/storage/v1/object/list/${bucket}`,
        {
          method: "POST",
          json: {
            prefix,
            limit: 100,
            offset,
            sortBy: { column: "name", order: "asc" },
          },
        },
      );
      const entries = await response.json();
      if (!Array.isArray(entries)) {
        throw new Error("Storage inventory returned an invalid response.");
      }
      for (const entry of entries) {
        const key = prefix ? `${prefix}/${entry.name}` : entry.name;
        validateObjectKey(key);
        if (entry.id) {
          found.push({
            key,
            mediaType: entry.metadata?.mimetype ?? "application/octet-stream",
            createdAt: entry.created_at ?? null,
            updatedAt: entry.updated_at ?? null,
          });
        } else {
          prefixes.push(key);
        }
      }
      if (entries.length < 100) break;
      offset += entries.length;
    }
  }

  return found;
}

async function restoreAndVerifyStorage(manifest) {
  const restoredManifest = [];
  for (const object of manifest) {
    const restoreKey = `${object.bucket}/${object.key}`;
    const bytes = readFileSync(object.backup_file);
    await uploadObject(restoreBucket, restoreKey, bytes, object.media_type);
    const restoredBytes = await downloadObject(restoreBucket, restoreKey);
    const restoredSha256 = sha256(restoredBytes);
    if (
      restoredSha256 !== object.sha256 ||
      restoredBytes.length !== object.byte_size
    ) {
      throw new Error(
        "A restored Storage object failed checksum verification.",
      );
    }
    restoredManifest.push({
      bucket: object.bucket,
      key: object.key,
      byte_size: restoredBytes.length,
      sha256: restoredSha256,
    });
  }

  return {
    aggregates: storageAggregates(restoredManifest),
    aggregateSha256: storageAggregateSha256(restoredManifest),
  };
}

function storageAggregates(manifest) {
  const buckets = {};
  for (const object of manifest) {
    const current = buckets[object.bucket] ?? { objects: 0, bytes: 0 };
    current.objects += 1;
    current.bytes += object.byte_size;
    buckets[object.bucket] = current;
  }
  for (const bucket of ["generated-exports", "policy-sources"]) {
    buckets[bucket] ??= { objects: 0, bytes: 0 };
  }
  return {
    buckets,
    total_objects: manifest.length,
    total_bytes: manifest.reduce(
      (total, object) => total + object.byte_size,
      0,
    ),
  };
}

function storageAggregateSha256(manifest) {
  const lines = manifest
    .map((object) => `${object.bucket}:${object.key}:${object.sha256}`)
    .sort();
  return sha256(Buffer.from(lines.join("\n"), "utf8"));
}

async function createRestoreBucket() {
  await storageRequest("/storage/v1/bucket", {
    method: "POST",
    json: {
      id: restoreBucket,
      name: restoreBucket,
      public: false,
      file_size_limit: 52428800,
      allowed_mime_types: [
        "application/pdf",
        "application/zip",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "text/plain",
      ],
    },
  });
}

async function uploadObject(bucket, key, bytes, mediaType) {
  validateObjectKey(key);
  await storageRequest(
    `/storage/v1/object/${encodeURIComponent(bucket)}/${encodeObjectKey(key)}`,
    {
      method: "POST",
      body: bytes,
      headers: { "Content-Type": mediaType, "x-upsert": "false" },
    },
  );
}

async function downloadObject(bucket, key) {
  validateObjectKey(key);
  const response = await storageRequest(
    `/storage/v1/object/authenticated/${encodeURIComponent(bucket)}/${encodeObjectKey(key)}`,
  );
  return Buffer.from(await response.arrayBuffer());
}

async function removeObjects(bucket, keys) {
  if (keys.length === 0) return;
  await storageRequest(`/storage/v1/object/${encodeURIComponent(bucket)}`, {
    method: "DELETE",
    json: { prefixes: keys },
  });
}

async function removeRestoreBucket() {
  if (!restoreBucketCreated) return;
  await storageRequest(
    `/storage/v1/bucket/${encodeURIComponent(restoreBucket)}/empty`,
    {
      method: "POST",
    },
  );
  await storageRequest(
    `/storage/v1/bucket/${encodeURIComponent(restoreBucket)}`,
    {
      method: "DELETE",
    },
  );
  restoreBucketCreated = false;
}

async function storageRequest(path, options = {}) {
  const headers = new Headers(options.headers);
  headers.set("Authorization", `Bearer ${serviceRoleKey}`);
  headers.set("apikey", serviceRoleKey);
  let body = options.body;
  if (options.json !== undefined) {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(options.json);
  }
  const response = await fetch(`${apiUrl}${path}`, {
    method: options.method ?? "GET",
    headers,
    body,
    redirect: "error",
  });
  if (!response.ok) {
    throw new Error(
      `Storage API operation failed with HTTP ${response.status}.`,
    );
  }
  return response;
}

function validateObjectKey(key) {
  if (
    typeof key !== "string" ||
    key.length < 1 ||
    key.length > 1024 ||
    key.startsWith("/") ||
    key.includes("\\") ||
    key.split("/").some((segment) => segment === "" || segment === "..")
  ) {
    throw new Error("Storage inventory contains an unsafe object key.");
  }
}

function encodeObjectKey(key) {
  return key.split("/").map(encodeURIComponent).join("/");
}

function dropRestoreDatabase() {
  if (!restoreDatabaseCreated) return;
  run(
    "docker",
    [
      "exec",
      databaseContainer,
      "dropdb",
      "-U",
      "supabase_admin",
      "--if-exists",
      "--force",
      restoreDatabase,
    ],
    "remove the isolated local restore database",
  );
  restoreDatabaseCreated = false;
}

function removeContainerFiles() {
  run(
    "docker",
    [
      "exec",
      databaseContainer,
      "rm",
      "-f",
      containerDumpPath,
      containerRestorePath,
    ],
    "remove bounded temporary database files",
  );
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
