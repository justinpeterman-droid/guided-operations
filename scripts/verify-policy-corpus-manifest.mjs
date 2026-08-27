import { createHash } from "node:crypto";
import {
  createReadStream,
  lstatSync,
  readFileSync,
  realpathSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";

const MAX_MANIFEST_BYTES = 5 * 1024 * 1024;
const MAX_ENTRIES = 5_000;
const MAX_SOURCE_BYTES = 2 * 1024 * 1024 * 1024;
const MAX_TOTAL_BYTES = 2 * 1024 * 1024 * 1024 * 1024;
const MAX_PAGE_COUNT = 100_000;
const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._-]{7,159}$/u;
const STABLE_KEY = /^[a-z0-9][a-z0-9_-]{1,127}$/u;
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const SHA256 = /^[a-f0-9]{64}$/u;
const REGION = /^[a-z0-9][a-z0-9-]{1,62}$/u;
const SAFE_REFERENCE = /^[A-Za-z0-9][A-Za-z0-9:._/-]{2,199}$/u;
const TOOL_VALUE = /^[A-Za-z0-9][A-Za-z0-9 ._+/-]{0,119}$/u;
const APPROVED_RIGHTS = new Set([
  "approved_internal_search",
  "approved_full_reader",
]);
const LIFECYCLE = new Set(["active", "superseded"]);
const CLASSIFICATIONS = new Set(["public", "internal", "restricted"]);
const MANIFEST_KEYS = new Set([
  "manifest_version",
  "corpus_version",
  "storage_bucket_alias",
  "custodian_approval_ref",
  "rights_review_approval_ref",
  "generated_at_utc",
  "entries",
]);
const ENTRY_KEYS = new Set([
  "document_id",
  "document_version_id",
  "stable_key",
  "title",
  "version_label",
  "effective_on",
  "source_file",
  "source_sha256",
  "byte_size",
  "mime_type",
  "page_count",
  "classification",
  "rights_status",
  "rights_evidence_ref",
  "rights_reviewed_at_utc",
  "rights_review_due_at_utc",
  "allowed_processing_regions",
  "external_ai_allowed",
  "lifecycle_status",
  "is_current",
  "supersedes_document_version_id",
  "duplicate_bytes_approval_ref",
  "malware_scan",
  "file_validation",
  "storage_bucket_alias",
  "storage_object_key",
]);
const SCAN_KEYS = new Set([
  "status",
  "tool_alias",
  "tool_version",
  "completed_at_utc",
  "source_sha256",
  "byte_size",
]);
const FILE_VALIDATION_KEYS = new Set([
  ...SCAN_KEYS,
  "detected_mime_type",
  "page_count",
]);

export async function verifyPolicyCorpusManifest({
  manifestPath,
  sourceRoot,
  projectRoot = process.cwd(),
  now = new Date(),
}) {
  const resolvedProjectRoot = requireRealpath(projectRoot, "The repository");
  const resolvedManifestPath = requireRealpath(
    manifestPath,
    "The private corpus manifest",
  );
  const resolvedSourceRoot = requireRealpath(
    sourceRoot,
    "The private corpus source root",
  );
  requireOutsideRepository(
    resolvedManifestPath,
    resolvedProjectRoot,
    "The private corpus manifest",
  );
  requireOutsideRepository(
    resolvedSourceRoot,
    resolvedProjectRoot,
    "The private corpus source root",
  );
  requireDoesNotContainRepository(
    resolvedSourceRoot,
    resolvedProjectRoot,
    "The private corpus source root",
  );

  const manifestStats = requireFileStats(
    resolvedManifestPath,
    "The private corpus manifest",
  );
  if (!manifestStats.isFile() || manifestStats.size > MAX_MANIFEST_BYTES) {
    fail("The private corpus manifest must be a bounded regular file.");
  }

  let rawManifest;
  try {
    rawManifest = readFileSync(resolvedManifestPath);
  } catch {
    fail("The private corpus manifest could not be read.");
  }
  let manifest;
  try {
    manifest = JSON.parse(rawManifest.toString("utf8"));
  } catch {
    fail("The private corpus manifest is not valid JSON.");
  }

  const normalizedNow = requireDate(now, "Verification time");
  const generatedAt = validateManifestHeader(manifest, normalizedNow);

  const versionIds = new Set();
  const sourcePaths = new Set();
  const storageKeys = new Set();
  const stableKeyDocuments = new Map();
  const familyEntries = new Map();
  const versionEntries = new Map();
  const hashEntries = new Map();
  let totalBytes = 0;
  let activeEntryCount = 0;
  let currentEntryCount = 0;
  let externalAiAllowedCount = 0;

  for (const [index, entry] of manifest.entries.entries()) {
    const label = `Corpus entry ${index + 1}`;
    validateEntry(
      entry,
      label,
      manifest.storage_bucket_alias,
      normalizedNow,
      generatedAt,
    );
    requireUnique(versionIds, entry.document_version_id, `${label} version ID`);
    requireUnique(sourcePaths, entry.source_file, `${label} source path`);
    requireUnique(
      storageKeys,
      entry.storage_object_key,
      `${label} Storage key`,
    );
    const stableKeyDocument = stableKeyDocuments.get(entry.stable_key);
    if (stableKeyDocument && stableKeyDocument !== entry.document_id) {
      fail(`${label} stable key is assigned to multiple policy documents.`);
    }
    stableKeyDocuments.set(entry.stable_key, entry.document_id);

    const sourcePath = resolvePrivateSource(
      resolvedSourceRoot,
      entry.source_file,
      label,
      resolvedProjectRoot,
    );
    const sourceStats = requireFileStats(sourcePath, `${label} source`);
    if (!sourceStats.isFile()) {
      fail(`${label} source must be a regular non-symbolic file.`);
    }
    if (sourceStats.size !== entry.byte_size) {
      fail(`${label} byte size does not match the source file.`);
    }
    await requirePdfMagic(sourcePath, label);
    const actualHash = await sha256File(sourcePath);
    const sourceStatsAfter = requireFileStats(sourcePath, `${label} source`);
    if (
      sourceStats.dev !== sourceStatsAfter.dev ||
      sourceStats.ino !== sourceStatsAfter.ino ||
      sourceStats.size !== sourceStatsAfter.size ||
      sourceStats.mtimeMs !== sourceStatsAfter.mtimeMs
    ) {
      fail(`${label} source changed during verification.`);
    }
    if (actualHash !== entry.source_sha256) {
      fail(`${label} SHA-256 does not match the source file.`);
    }

    const matchingEntries = hashEntries.get(actualHash) ?? [];
    matchingEntries.push(entry);
    hashEntries.set(actualHash, matchingEntries);

    totalBytes += entry.byte_size;
    if (!Number.isSafeInteger(totalBytes) || totalBytes > MAX_TOTAL_BYTES) {
      fail("Corpus aggregate byte size exceeds the verification limit.");
    }
    if (entry.lifecycle_status === "active") activeEntryCount += 1;
    if (entry.is_current) currentEntryCount += 1;
    if (entry.external_ai_allowed) externalAiAllowedCount += 1;

    const family = familyEntries.get(entry.document_id) ?? [];
    family.push(entry);
    familyEntries.set(entry.document_id, family);
    versionEntries.set(entry.document_version_id, entry);
  }

  validateFamilies(familyEntries, versionEntries);
  validateDuplicateBytes(hashEntries);

  return Object.freeze({
    evidence_version: 1,
    corpus_version: manifest.corpus_version,
    manifest_sha256: sha256(rawManifest),
    entry_count: manifest.entries.length,
    active_entry_count: activeEntryCount,
    current_entry_count: currentEntryCount,
    external_ai_allowed_count: externalAiAllowedCount,
    total_bytes: totalBytes,
    duplicate_byte_group_count: [...hashEntries.values()].filter(
      (entries) => entries.length > 1,
    ).length,
    verified_at_utc: normalizedNow.toISOString(),
  });
}

function validateManifestHeader(manifest, now) {
  requireObject(manifest, "The private corpus manifest");
  requireExactKeys(manifest, MANIFEST_KEYS, "The private corpus manifest");
  if (manifest.manifest_version !== 1) {
    fail("The private corpus manifest version is unsupported.");
  }
  requireIdentifier(manifest.corpus_version, "The corpus version");
  requireIdentifier(
    manifest.storage_bucket_alias,
    "The private Storage bucket alias",
  );
  requireReference(manifest.custodian_approval_ref, "The custodian approval");
  requireReference(
    manifest.rights_review_approval_ref,
    "The rights-review approval",
  );
  const generatedAt = requireUtc(
    manifest.generated_at_utc,
    "The manifest generation time",
  );
  if (generatedAt > now) {
    fail(
      "The private corpus manifest generation time cannot be in the future.",
    );
  }
  if (
    !Array.isArray(manifest.entries) ||
    manifest.entries.length < 1 ||
    manifest.entries.length > MAX_ENTRIES
  ) {
    fail(
      "The private corpus manifest must contain a bounded non-empty entry list.",
    );
  }
  return generatedAt;
}

function validateEntry(entry, label, storageBucketAlias, now, generatedAt) {
  requireObject(entry, label);
  requireExactKeys(entry, ENTRY_KEYS, label);
  requireUuid(entry.document_id, `${label} document ID`);
  requireUuid(entry.document_version_id, `${label} version ID`);
  requireStableKey(entry.stable_key, `${label} stable key`);
  requireBoundedText(entry.title, 1, 300, `${label} title`);
  requireBoundedText(entry.version_label, 1, 120, `${label} version label`);
  if (entry.effective_on !== null) {
    requireDateOnly(entry.effective_on, `${label} effective date`);
  }
  requireRelativePdfPath(entry.source_file, `${label} source path`);
  requireSha256(entry.source_sha256, `${label} source SHA-256`);
  requireBoundedPositiveInteger(
    entry.byte_size,
    MAX_SOURCE_BYTES,
    `${label} byte size`,
  );
  if (entry.mime_type !== "application/pdf") {
    fail(`${label} MIME type must be application/pdf.`);
  }
  requireBoundedPositiveInteger(
    entry.page_count,
    MAX_PAGE_COUNT,
    `${label} page count`,
  );
  if (!CLASSIFICATIONS.has(entry.classification)) {
    fail(`${label} classification is unsupported.`);
  }
  if (!APPROVED_RIGHTS.has(entry.rights_status)) {
    fail(`${label} rights status is not approved for retrieval.`);
  }
  requireReference(entry.rights_evidence_ref, `${label} rights evidence`);
  const reviewedAt = requireUtc(
    entry.rights_reviewed_at_utc,
    `${label} rights review time`,
  );
  if (reviewedAt > now) fail(`${label} rights review time is in the future.`);
  if (reviewedAt > generatedAt) {
    fail(`${label} rights review time follows manifest generation.`);
  }
  if (entry.rights_review_due_at_utc !== null) {
    const dueAt = requireUtc(
      entry.rights_review_due_at_utc,
      `${label} rights review due time`,
    );
    if (dueAt <= now) fail(`${label} rights review is expired.`);
    if (dueAt <= reviewedAt) {
      fail(`${label} rights review due time must follow its review time.`);
    }
  }
  requireRegions(entry.allowed_processing_regions, label);
  if (typeof entry.external_ai_allowed !== "boolean") {
    fail(`${label} external-AI permission must be boolean.`);
  }
  if (!LIFECYCLE.has(entry.lifecycle_status)) {
    fail(`${label} lifecycle status is not ingestion-ready.`);
  }
  if (typeof entry.is_current !== "boolean") {
    fail(`${label} current-version flag must be boolean.`);
  }
  if (entry.is_current && entry.lifecycle_status !== "active") {
    fail(`${label} current version must be active.`);
  }
  if (entry.supersedes_document_version_id !== null) {
    requireUuid(
      entry.supersedes_document_version_id,
      `${label} superseded version ID`,
    );
    if (entry.supersedes_document_version_id === entry.document_version_id) {
      fail(`${label} cannot supersede itself.`);
    }
  }
  if (entry.duplicate_bytes_approval_ref !== null) {
    requireReference(
      entry.duplicate_bytes_approval_ref,
      `${label} duplicate-bytes approval`,
    );
  }
  validateScan(
    entry.malware_scan,
    `${label} malware scan`,
    entry,
    now,
    generatedAt,
    SCAN_KEYS,
  );
  validateScan(
    entry.file_validation,
    `${label} file validation`,
    entry,
    now,
    generatedAt,
    FILE_VALIDATION_KEYS,
  );
  if (
    entry.file_validation.detected_mime_type !== "application/pdf" ||
    entry.file_validation.page_count !== entry.page_count
  ) {
    fail(`${label} file validation does not match the reviewed PDF metadata.`);
  }
  const expectedStorageKey = `${entry.document_id}/${entry.source_sha256}.pdf`;
  if (entry.storage_bucket_alias !== storageBucketAlias) {
    fail(`${label} Storage bucket alias does not match the manifest.`);
  }
  if (entry.storage_object_key !== expectedStorageKey) {
    fail(`${label} Storage object key is not content-addressed.`);
  }
}

function validateScan(scan, label, entry, now, generatedAt, allowedKeys) {
  requireObject(scan, label);
  requireExactKeys(scan, allowedKeys, label);
  if (scan.status !== "passed") fail(`${label} has not passed.`);
  requireToolValue(scan.tool_alias, `${label} tool alias`);
  requireToolValue(scan.tool_version, `${label} tool version`);
  const scannedAt = requireUtc(
    scan.completed_at_utc,
    `${label} completion time`,
  );
  if (scannedAt > now) fail(`${label} completion time is in the future.`);
  if (scannedAt > generatedAt) {
    fail(`${label} completion time follows manifest generation.`);
  }
  if (
    scan.source_sha256 !== entry.source_sha256 ||
    scan.byte_size !== entry.byte_size
  ) {
    fail(`${label} is not bound to the reviewed source bytes.`);
  }
}

function validateFamilies(families, versions) {
  for (const entries of families.values()) {
    const familyKeys = new Set(entries.map((entry) => entry.stable_key));
    const familyTitles = new Set(entries.map((entry) => entry.title));
    const familyClassifications = new Set(
      entries.map((entry) => entry.classification),
    );
    if (
      familyKeys.size !== 1 ||
      familyTitles.size !== 1 ||
      familyClassifications.size !== 1
    ) {
      fail("Policy document metadata must remain stable across versions.");
    }
    const currentEntries = entries.filter((entry) => entry.is_current);
    if (currentEntries.length !== 1) {
      fail(
        "Each policy family must have exactly one reviewed current version.",
      );
    }
    for (const entry of entries) {
      if (
        (entry.is_current && entry.lifecycle_status !== "active") ||
        (!entry.is_current && entry.lifecycle_status !== "superseded")
      ) {
        fail("Policy lifecycle status must match the reviewed version chain.");
      }
      const superseded = entry.supersedes_document_version_id;
      if (!superseded) continue;
      const prior = versions.get(superseded);
      if (!prior || prior.document_id !== entry.document_id) {
        fail(
          "A supersedes reference must resolve inside the same policy family.",
        );
      }
      if (
        entry.effective_on !== null &&
        prior.effective_on !== null &&
        entry.effective_on < prior.effective_on
      ) {
        fail("A policy version cannot supersede a later effective version.");
      }
    }
    const visited = new Set();
    let current = currentEntries[0];
    for (;;) {
      if (visited.has(current.document_version_id)) {
        fail("A policy version chain cannot contain a cycle.");
      }
      visited.add(current.document_version_id);
      if (!current.supersedes_document_version_id) break;
      current = versions.get(current.supersedes_document_version_id);
    }
    if (visited.size !== entries.length) {
      fail("Every policy version must belong to one current version chain.");
    }
  }
}

function validateDuplicateBytes(hashEntries) {
  for (const entries of hashEntries.values()) {
    if (entries.length === 1) {
      if (entries[0].duplicate_bytes_approval_ref !== null) {
        fail("A unique source cannot carry a duplicate-bytes approval.");
      }
      continue;
    }
    const approvals = new Set(
      entries.map((entry) => entry.duplicate_bytes_approval_ref),
    );
    if (approvals.size !== 1 || approvals.has(null)) {
      fail(
        "Duplicate source bytes require one shared controlled approval reference.",
      );
    }
  }
}

function resolvePrivateSource(sourceRoot, sourceFile, label, projectRoot) {
  const candidate = resolve(sourceRoot, ...sourceFile.split("/"));
  let candidateStats;
  try {
    candidateStats = lstatSync(candidate);
  } catch {
    fail(`${label} source could not be resolved.`);
  }
  if (candidateStats.isSymbolicLink()) {
    fail(`${label} source must be a regular non-symbolic file.`);
  }
  const realCandidate = requireRealpath(candidate, `${label} source`);
  const relation = relative(sourceRoot, realCandidate);
  if (
    relation === "" ||
    relation.startsWith(`..${sep}`) ||
    isAbsolute(relation)
  ) {
    fail(`${label} resolves outside the approved source root.`);
  }
  requireOutsideRepository(realCandidate, projectRoot, `${label} source file`);
  return realCandidate;
}

function requireRealpath(value, label) {
  try {
    return realpathSync(resolve(value));
  } catch {
    fail(`${label} could not be resolved.`);
  }
}

function requireFileStats(path, label) {
  try {
    return statSync(path);
  } catch {
    fail(`${label} metadata could not be read.`);
  }
}

function requireOutsideRepository(target, projectRoot, label) {
  const relation = relative(projectRoot, target);
  if (
    relation === "" ||
    (relation !== ".." &&
      !relation.startsWith(`..${sep}`) &&
      !isAbsolute(relation))
  ) {
    fail(`${label} must remain outside the repository.`);
  }
}

function requireDoesNotContainRepository(target, projectRoot, label) {
  const relation = relative(target, projectRoot);
  if (
    relation === "" ||
    (relation !== ".." &&
      !relation.startsWith(`..${sep}`) &&
      !isAbsolute(relation))
  ) {
    fail(`${label} must not contain the repository.`);
  }
}

async function requirePdfMagic(path, label) {
  const chunks = [];
  try {
    const stream = createReadStream(path, { start: 0, end: 4 });
    for await (const chunk of stream) chunks.push(chunk);
  } catch {
    fail(`${label} source could not be read.`);
  }
  if (Buffer.concat(chunks).toString("ascii") !== "%PDF-") {
    fail(`${label} file signature is not PDF.`);
  }
}

async function sha256File(path) {
  const hash = createHash("sha256");
  try {
    for await (const chunk of createReadStream(path)) hash.update(chunk);
  } catch {
    fail("A private corpus source could not be hashed.");
  }
  return hash.digest("hex");
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function requireRegions(value, label) {
  if (!Array.isArray(value) || value.length < 1 || value.length > 20) {
    fail(`${label} must include bounded allowed processing regions.`);
  }
  if (new Set(value).size !== value.length) {
    fail(`${label} allowed processing regions must be unique.`);
  }
  if (
    value.some((region) => typeof region !== "string" || !REGION.test(region))
  ) {
    fail(`${label} contains an invalid processing region.`);
  }
}

function requireExactKeys(value, allowedKeys, label) {
  const keys = Object.keys(value);
  if (
    keys.length !== allowedKeys.size ||
    keys.some((key) => !allowedKeys.has(key))
  ) {
    fail(`${label} fields do not match the approved manifest schema.`);
  }
}

function requireStableKey(value, label) {
  if (typeof value !== "string" || !STABLE_KEY.test(value)) {
    fail(`${label} must match the private policy registry key format.`);
  }
}

function requireBoundedText(value, minimum, maximum, label) {
  if (
    typeof value !== "string" ||
    value.length < minimum ||
    value.length > maximum ||
    value.trim() !== value ||
    /[\u0000-\u001f\u007f]/u.test(value)
  ) {
    fail(`${label} must be bounded clean text.`);
  }
}

function requireRelativePdfPath(value, label) {
  if (
    typeof value !== "string" ||
    value.length < 5 ||
    value.length > 1_024 ||
    value.includes("\\") ||
    value.includes("\0") ||
    isAbsolute(value) ||
    value
      .split("/")
      .some((part) => part === "" || part === "." || part === "..") ||
    !value.toLocaleLowerCase("en-US").endsWith(".pdf")
  ) {
    fail(`${label} must be a safe relative PDF path.`);
  }
}

function requireObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    fail(`${label} must be an object.`);
  }
}

function requireUuid(value, label) {
  if (typeof value !== "string" || !UUID.test(value)) {
    fail(`${label} must be a UUID.`);
  }
}

function requireSha256(value, label) {
  if (typeof value !== "string" || !SHA256.test(value)) {
    fail(`${label} must be a lowercase SHA-256.`);
  }
}

function requireIdentifier(value, label) {
  if (typeof value !== "string" || !IDENTIFIER.test(value)) {
    fail(`${label} must be a bounded opaque identifier.`);
  }
}

function requireReference(value, label) {
  if (typeof value !== "string" || !SAFE_REFERENCE.test(value)) {
    fail(`${label} must be a bounded controlled reference.`);
  }
}

function requireToolValue(value, label) {
  if (typeof value !== "string" || !TOOL_VALUE.test(value)) {
    fail(`${label} must be a bounded tool identifier.`);
  }
}

function requireBoundedPositiveInteger(value, maximum, label) {
  if (!Number.isSafeInteger(value) || value <= 0 || value > maximum) {
    fail(`${label} must be a bounded positive safe integer.`);
  }
}

function requireDateOnly(value, label) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/u.test(value)) {
    fail(`${label} must be a calendar date.`);
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (
    !Number.isFinite(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== value
  ) {
    fail(`${label} must be a real calendar date.`);
  }
  return parsed;
}

function requireUtc(value, label) {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/u.test(value)
  ) {
    fail(`${label} must be UTC.`);
  }
  const parsed = requireDate(new Date(value), label);
  const canonical = value.includes(".")
    ? parsed.toISOString()
    : parsed.toISOString().replace(".000Z", "Z");
  if (canonical !== value) fail(`${label} must be a real canonical UTC time.`);
  return parsed;
}

function requireDate(value, label) {
  if (!(value instanceof Date) || !Number.isFinite(value.getTime())) {
    fail(`${label} is invalid.`);
  }
  return value;
}

function requireUnique(seen, value, label) {
  if (seen.has(value)) fail(`${label} must be unique.`);
  seen.add(value);
}

function fail(message) {
  throw new Error(message);
}

function parseArguments(args) {
  const values = {};
  for (let index = 0; index < args.length; index += 2) {
    const flag = args[index];
    const value = args[index + 1];
    if (!flag?.startsWith("--") || !value || value.startsWith("--")) {
      fail(
        "Usage: --manifest <private-json> --source-root <private-dir> [--output <safe-evidence-json>]",
      );
    }
    if (!new Set(["--manifest", "--source-root", "--output"]).has(flag)) {
      fail("An unsupported corpus verification option was supplied.");
    }
    if (values[flag]) fail("A corpus verification option was duplicated.");
    values[flag] = value;
  }
  if (!values["--manifest"] || !values["--source-root"]) {
    fail(
      "Usage: --manifest <private-json> --source-root <private-dir> [--output <safe-evidence-json>]",
    );
  }
  return values;
}

async function main() {
  try {
    const args = parseArguments(process.argv.slice(2));
    const evidence = await verifyPolicyCorpusManifest({
      manifestPath: args["--manifest"],
      sourceRoot: args["--source-root"],
    });
    const serialized = `${JSON.stringify(evidence, null, 2)}\n`;
    if (args["--output"]) {
      const outputPath = resolve(args["--output"]);
      try {
        writeFileSync(outputPath, serialized, {
          encoding: "utf8",
          flag: "wx",
          mode: 0o600,
        });
      } catch {
        fail("The value-free corpus evidence output could not be created.");
      }
      console.log("Policy corpus verification passed.");
    } else {
      process.stdout.write(serialized);
    }
  } catch (error) {
    console.error(
      `Policy corpus verification failed: ${
        error instanceof Error ? error.message : "unknown failure"
      }`,
    );
    process.exitCode = 1;
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  await main();
}
