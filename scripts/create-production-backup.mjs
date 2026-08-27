import { spawn, execFileSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import {
  mkdirSync,
  createReadStream,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { basename, relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";

import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";

import {
  resolveBackupPaths,
  validateProductionBackupRequest,
} from "./production-backup-guard.mjs";

const MAX_STORAGE_OBJECTS = 1_000_000;
const MAX_DIRECTORY_DEPTH = 64;
export function buildProductionBackupEvidence(input) {
  return {
    evidence_version: 1,
    environment: "production",
    result: "success",
    backup_id: input.backupId,
    project_reference_sha256: sha256(Buffer.from(input.projectRef, "utf8")),
    region: input.region,
    approval_reference: input.approvalReference,
    target_reference_sha256: sha256(Buffer.from(input.targetId, "utf8")),
    encryption_recipient_sha256: sha256(
      Buffer.from(input.ageRecipient, "utf8"),
    ),
    database: input.database,
    storage: input.storage,
    encrypted_manifest: input.encryptedManifest,
    tools: input.tools,
    started_at: input.startedAt,
    completed_at: input.completedAt,
    expires_on: input.expiresOn,
    limitations: [
      "This value-free record proves encrypted backup creation, checksums, and aggregate reconciliation only.",
      "Restore verification in a separate isolated project remains required before this backup can authorize migration or deletion.",
      "The backup contains Production data and may exist only in the approved encrypted off-provider target.",
    ],
  };
}

export function opaqueObjectFileName(bucket, objectName) {
  return `${sha256(Buffer.from(`${bucket}\0${objectName}`, "utf8"))}.age`;
}

export async function inventoryPrivateStorage(storage) {
  const bucketsResult = await storage.listBuckets();
  if (bucketsResult.error || !Array.isArray(bucketsResult.data))
    throw new Error("Unable to inventory private Storage buckets.");

  const publicBucket = bucketsResult.data.find((bucket) => bucket.public);
  if (publicBucket)
    throw new Error(
      "Production backup rejected because a public bucket exists.",
    );

  const buckets = [...bucketsResult.data].sort((left, right) =>
    left.id.localeCompare(right.id),
  );
  const objects = [];
  for (const bucket of buckets) {
    await inventoryDirectory(storage, bucket.id, "", 0, objects);
    if (objects.length > MAX_STORAGE_OBJECTS)
      throw new Error("Production Storage inventory exceeds the safety limit.");
  }

  return { buckets, objects };
}

async function inventoryDirectory(storage, bucket, prefix, depth, objects) {
  if (depth > MAX_DIRECTORY_DEPTH)
    throw new Error("Production Storage inventory exceeds the depth limit.");

  let offset = 0;
  for (;;) {
    const result = await storage.from(bucket).list(prefix, {
      limit: 1000,
      offset,
      sortBy: { column: "name", order: "asc" },
    });
    if (result.error || !Array.isArray(result.data))
      throw new Error("Unable to inventory private Storage objects.");

    for (const item of result.data) {
      const objectName = prefix ? `${prefix}/${item.name}` : item.name;
      if (item.id == null) {
        await inventoryDirectory(
          storage,
          bucket,
          objectName,
          depth + 1,
          objects,
        );
      } else {
        objects.push({
          bucket,
          name: objectName,
          bytes: numericSize(item.metadata?.size),
          media_type: item.metadata?.mimetype ?? null,
          created_at: item.created_at ?? null,
          updated_at: item.updated_at ?? null,
        });
      }
      if (objects.length > MAX_STORAGE_OBJECTS)
        throw new Error(
          "Production Storage inventory exceeds the safety limit.",
        );
    }

    if (result.data.length < 1000) break;
    offset += result.data.length;
  }
}

function numericSize(value) {
  const size = Number(value);
  return Number.isSafeInteger(size) && size >= 0 ? size : null;
}

export function validateBackupExpiry(value, now = new Date()) {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value ?? "")) return false;
  const [year, month, day] = value.split("-").map(Number);
  const expiry = new Date(`${value}T23:59:59.999Z`);
  return (
    Number.isFinite(expiry.getTime()) &&
    expiry.getUTCFullYear() === year &&
    expiry.getUTCMonth() + 1 === month &&
    expiry.getUTCDate() === day &&
    expiry.getTime() > now.getTime()
  );
}

export function normalizeMigrationVersions(rows) {
  const versions = rows.map((row) => String(row.version));
  if (
    versions.length === 0 ||
    versions.some((version) => !/^\d{14}$/u.test(version)) ||
    versions.some(
      (version, index) => index > 0 && version <= versions[index - 1],
    )
  )
    throw new Error("Production backup migration history is invalid.");
  return { migration_count: versions.length, migration_head: versions.at(-1) };
}

function environmentInput() {
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
    destinationRoot: process.env.PRODUCTION_BACKUP_DESTINATION,
    expiresOn: process.env.PRODUCTION_BACKUP_EXPIRES_ON,
    pgDumpPath: process.env.PRODUCTION_BACKUP_PG_DUMP_PATH || "pg_dump",
    agePath: process.env.PRODUCTION_BACKUP_AGE_PATH || "age",
  };
}

async function main() {
  const input = environmentInput();
  let paths;
  try {
    paths = resolveBackupPaths({
      repositoryRoot: process.cwd(),
      destinationRoot: input.destinationRoot,
    });
  } catch {
    throw new Error("The protected backup destination could not be verified.");
  }
  const validation = validateProductionBackupRequest(input, paths);
  if (!validateBackupExpiry(input.expiresOn))
    validation.errors.push("A future backup expiry date is required.");
  if (validation.errors.length > 0)
    throw new Error(
      `Production backup request rejected: ${validation.errors.join(" ")}`,
    );

  const startedAt = new Date().toISOString();
  const backupId = createBackupId(new Date());
  const backupRoot = createBackupRoot(paths.destinationRoot, backupId);

  try {
    const tools = {
      pg_dump: toolVersion(input.pgDumpPath, ["--version"]),
      age: toolVersion(input.agePath, ["--version"]),
      node: process.version,
    };
    const database = await backupDatabase({ input, backupRoot });
    const client = createClient(input.supabaseUrl, input.supabaseSecretKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { "Cache-Control": "no-store" } },
    });
    const inventory = await inventoryPrivateStorage(client.storage);
    const storage = await backupStorage({
      input,
      backupRoot,
      inventory,
    });
    const manifest = {
      manifest_version: 1,
      backup_id: backupId,
      project_reference: input.projectRef,
      region: input.region,
      database,
      buckets: inventory.buckets.map((bucket) => ({
        id: bucket.id,
        name: bucket.name,
        public: false,
        file_size_limit: bucket.file_size_limit ?? null,
        allowed_mime_types: bucket.allowed_mime_types ?? null,
        created_at: bucket.created_at ?? null,
        updated_at: bucket.updated_at ?? null,
      })),
      objects: storage.objects,
      created_at: startedAt,
      expires_on: input.expiresOn,
    };
    const encryptedManifest = await encryptBuffer({
      bytes: Buffer.from(`${JSON.stringify(manifest)}\n`, "utf8"),
      outputPath: resolve(backupRoot, "manifest.json.age"),
      recipient: input.ageRecipient,
      agePath: input.agePath,
    });
    const evidence = buildProductionBackupEvidence({
      backupId,
      projectRef: input.projectRef,
      region: input.region,
      approvalReference: input.approvalReference,
      targetId: paths.targetAttestation.target_id,
      ageRecipient: input.ageRecipient,
      database,
      storage: storage.evidence,
      encryptedManifest: encryptedManifest.ciphertext,
      tools,
      startedAt,
      completedAt: new Date().toISOString(),
      expiresOn: input.expiresOn,
    });
    writeFileSync(
      resolve(backupRoot, "backup-evidence.json"),
      `${JSON.stringify(evidence, null, 2)}\n`,
      { encoding: "utf8", mode: 0o600 },
    );
    console.log(`Encrypted Production backup completed: ${backupId}`);
  } catch (error) {
    removeIncompleteBackup(paths.destinationRoot, backupRoot, backupId);
    throw new Error(
      error instanceof Error && error.message.startsWith("Production backup")
        ? error.message
        : "Production backup failed; incomplete encrypted output was removed.",
    );
  }
}

function createBackupId(now) {
  const timestamp = now.toISOString().replace(/[-:.]/gu, "");
  return `backup-${timestamp}-${randomBytes(8).toString("hex")}`;
}

function createBackupRoot(destinationRoot, backupId) {
  const backupRoot = resolve(destinationRoot, backupId);
  assertDirectChild(destinationRoot, backupRoot, backupId);
  mkdirSync(backupRoot, { recursive: false, mode: 0o700 });
  mkdirSync(resolve(backupRoot, "objects"), { recursive: false, mode: 0o700 });
  return backupRoot;
}

function removeIncompleteBackup(destinationRoot, backupRoot, backupId) {
  assertDirectChild(destinationRoot, backupRoot, backupId);
  rmSync(backupRoot, { recursive: true, force: true });
}

function assertDirectChild(destinationRoot, backupRoot, backupId) {
  if (!/^backup-\d{8}T\d{9}Z-[a-f0-9]{16}$/u.test(backupId))
    throw new Error("Production backup identifier is invalid.");
  const child = relative(resolve(destinationRoot), resolve(backupRoot));
  if (
    child !== backupId ||
    child.includes(sep) ||
    basename(backupRoot) !== backupId
  )
    throw new Error("Production backup output escaped the protected target.");
}

function toolVersion(executable, args) {
  try {
    return execFileSync(executable, args, {
      encoding: "utf8",
      env: sanitizedToolEnvironment(),
      windowsHide: true,
      timeout: 10_000,
    })
      .trim()
      .slice(0, 120);
  } catch {
    throw new Error("Production backup prerequisite is unavailable.");
  }
}

async function backupDatabase({ input, backupRoot }) {
  const outputPath = resolve(backupRoot, "database.dump.age");
  const metadata = await readDatabaseMetadata(input.databaseUrl);
  const dumper = spawn(
    input.pgDumpPath,
    ["--format=custom", "--no-owner", "--no-privileges"],
    {
      env: {
        ...sanitizedToolEnvironment(),
        PGDATABASE: input.databaseUrl,
      },
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    },
  );
  discard(dumper.stderr);
  const dumpExitPromise = childExit(dumper);
  const [encrypted, dumpExit] = await Promise.all([
    encryptReadable({
      readable: dumper.stdout,
      outputPath,
      recipient: input.ageRecipient,
      agePath: input.agePath,
    }),
    dumpExitPromise,
  ]);
  if (dumpExit !== 0) {
    rmSync(outputPath, { force: true });
    throw new Error("Production backup database export failed.");
  }
  return { ...metadata, ...encrypted };
}

async function readDatabaseMetadata(databaseUrl) {
  const sql = postgres(databaseUrl, {
    max: 1,
    prepare: false,
    connect_timeout: 10,
    idle_timeout: 5,
    ssl: "require",
    onnotice: () => {},
  });
  try {
    const versions = await sql`
      select version::text as version
      from supabase_migrations.schema_migrations
      order by version
    `;
    const server = await sql`
      select current_setting('server_version') as server_version
    `;
    return {
      ...normalizeMigrationVersions(versions),
      server_version: String(server[0]?.server_version ?? "unknown").slice(
        0,
        40,
      ),
    };
  } finally {
    await sql.end({ timeout: 2 });
  }
}

async function backupStorage({ input, backupRoot, inventory }) {
  const objects = [];
  let plaintextBytes = 0;
  let ciphertextBytes = 0;
  const ciphertextDigests = [];

  for (const object of inventory.objects) {
    const response = await fetch(storageObjectUrl(input.supabaseUrl, object), {
      method: "GET",
      headers: {
        apikey: input.supabaseSecretKey,
        Authorization: `Bearer ${input.supabaseSecretKey}`,
        "Cache-Control": "no-store",
      },
      cache: "no-store",
      redirect: "error",
    });
    if (!response.ok || !response.body)
      throw new Error("Production backup could not read a private object.");

    const ciphertextFile = opaqueObjectFileName(object.bucket, object.name);
    const encrypted = await encryptReadable({
      readable: Readable.fromWeb(response.body),
      outputPath: resolve(backupRoot, "objects", ciphertextFile),
      recipient: input.ageRecipient,
      agePath: input.agePath,
    });
    if (object.bytes !== null && encrypted.plaintext.bytes !== object.bytes)
      throw new Error("Production backup object size did not reconcile.");

    plaintextBytes += encrypted.plaintext.bytes;
    ciphertextBytes += encrypted.ciphertext.bytes;
    ciphertextDigests.push(encrypted.ciphertext.sha256);
    objects.push({
      ...object,
      bytes: encrypted.plaintext.bytes,
      sha256: encrypted.plaintext.sha256,
      ciphertext_file: `objects/${ciphertextFile}`,
      ciphertext_bytes: encrypted.ciphertext.bytes,
      ciphertext_sha256: encrypted.ciphertext.sha256,
    });
  }

  return {
    objects,
    evidence: {
      bucket_count: inventory.buckets.length,
      object_count: objects.length,
      plaintext_bytes: plaintextBytes,
      ciphertext_bytes: ciphertextBytes,
      ciphertext_set_sha256: sha256(
        Buffer.from([...ciphertextDigests].sort().join("\n"), "utf8"),
      ),
    },
  };
}

function storageObjectUrl(supabaseUrl, object) {
  const bucket = encodeURIComponent(object.bucket);
  const name = object.name
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
  return `${supabaseUrl}/storage/v1/object/authenticated/${bucket}/${name}`;
}

async function encryptBuffer({ bytes, ...options }) {
  return encryptReadable({ readable: Readable.from(bytes), ...options });
}

async function encryptReadable({ readable, outputPath, recipient, agePath }) {
  const partialPath = `${outputPath}.partial`;
  const plaintextHash = createHash("sha256");
  let plaintextBytes = 0;
  const meter = new Transform({
    transform(chunk, _encoding, callback) {
      plaintextBytes += chunk.length;
      plaintextHash.update(chunk);
      callback(null, chunk);
    },
  });
  const encryptor = spawn(
    agePath,
    ["--recipient", recipient, "--output", partialPath],
    {
      env: sanitizedToolEnvironment(),
      stdio: ["pipe", "ignore", "pipe"],
      windowsHide: true,
    },
  );
  discard(encryptor.stderr);
  const encryptorExitPromise = childExit(encryptor);

  try {
    const [, exitCode] = await Promise.all([
      pipeline(readable, meter, encryptor.stdin),
      encryptorExitPromise,
    ]);
    if (exitCode !== 0) throw new Error("Production backup encryption failed.");
    renameSync(partialPath, outputPath);
    return {
      plaintext: {
        bytes: plaintextBytes,
        sha256: plaintextHash.digest("hex"),
      },
      ciphertext: await fileDigest(outputPath),
    };
  } catch {
    encryptor.kill();
    rmSync(partialPath, { force: true });
    rmSync(outputPath, { force: true });
    throw new Error("Production backup encryption failed.");
  }
}

function sanitizedToolEnvironment() {
  const allowed = [
    "PATH",
    "Path",
    "PATHEXT",
    "SYSTEMROOT",
    "SystemRoot",
    "WINDIR",
    "TEMP",
    "TMP",
    "TMPDIR",
    "HOME",
    "USERPROFILE",
  ];
  return Object.fromEntries(
    allowed
      .filter((name) => process.env[name] !== undefined)
      .map((name) => [name, process.env[name]]),
  );
}

function childExit(child) {
  return new Promise((resolveExit, rejectExit) => {
    child.once("error", rejectExit);
    child.once("close", (code) => resolveExit(code ?? 1));
  });
}

function discard(stream) {
  stream?.resume();
}

async function fileDigest(filePath) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(filePath)) hash.update(chunk);
  return { bytes: statSync(filePath).size, sha256: hash.digest("hex") };
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch((error) => {
    console.error(
      error instanceof Error
        ? error.message
        : "Production backup failed without retained output.",
    );
    process.exit(1);
  });
}
