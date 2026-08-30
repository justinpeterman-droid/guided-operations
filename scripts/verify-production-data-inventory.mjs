import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import postgres from "postgres";

const projectRoot = process.cwd();
const localCommandTimeoutMs = 15_000;
const inventoryPath = resolve(
  projectRoot,
  "docs/operations/production-data-inventory.json",
);
const requiredSurfaceIds = new Set([
  "surface:supabase-auth",
  "surface:vercel-runtime-logs",
  "surface:supabase-platform-logs",
  "surface:openai-api",
  "surface:browser-storage",
  "surface:git-and-github",
  "surface:ci",
  "surface:vercel-preview",
  "surface:local-development",
  "surface:support-and-captures",
  "surface:database-backup",
  "surface:storage-backup",
]);

const inventory = readInventory();
validateInventory(inventory);
const status = readLocalSupabaseStatus();
const databaseUrl = requireLoopbackDatabaseUrl(status.DB_URL);
const sql = postgres(databaseUrl, {
  max: 1,
  prepare: false,
  connect_timeout: 5,
  ssl: false,
});

try {
  const tables = await sql`
    select tablename
    from pg_catalog.pg_tables
    where schemaname = 'app_private'
    order by tablename
  `;
  const buckets = await sql`
    select id
    from storage.buckets
    order by id
  `;

  compareExact(
    "app_private tables",
    inventory.stores
      .filter((item) => item.kind === "database_table")
      .map((item) => item.locator.replace(/^app_private\./u, "")),
    tables.map((item) => item.tablename),
  );
  compareExact(
    "Storage buckets",
    inventory.stores
      .filter((item) => item.kind === "storage_bucket")
      .map((item) => item.locator),
    buckets.map((item) => item.id),
  );

  console.log("Production data inventory passed.");
  console.log(`Private database tables covered: ${tables.length}`);
  console.log(`Private Storage buckets covered: ${buckets.length}`);
  console.log(
    `External processing surfaces covered: ${inventory.surfaces.length}`,
  );
  console.log("Hosted provider configuration remains a separate release gate.");
} catch (error) {
  fail(
    error instanceof Error ? error.message : "Inventory verification failed.",
  );
} finally {
  await sql.end({ timeout: 2 });
}

function readInventory() {
  try {
    return JSON.parse(readFileSync(inventoryPath, "utf8"));
  } catch {
    fail("The production data inventory is missing or invalid JSON.");
  }
}

function validateInventory(value) {
  requireObject(value, "inventory");
  if (value.inventory_version !== 1) {
    fail("The production data inventory version is unsupported.");
  }
  if (value.status !== "repository-complete-hosted-verification-pending") {
    fail("The inventory status must preserve the hosted-verification gate.");
  }
  requireObject(value.authority, "authority");
  if (
    value.authority.non_production_real_data !== "prohibited" ||
    value.authority.record_retention_days !== 730 ||
    value.authority.legal_hold_overrides_deletion !== true
  ) {
    fail("The inventory authority does not match the approved data boundary.");
  }
  requireObject(value.retention_profiles, "retention_profiles");
  requireArray(value.stores, "stores");
  requireArray(value.surfaces, "surfaces");

  const profileNames = new Set(Object.keys(value.retention_profiles));
  const ids = new Set();
  const locators = new Set();
  for (const store of value.stores) {
    validateEntry(store, "store", profileNames, ids);
    if (!new Set(["database_table", "storage_bucket"]).has(store.kind)) {
      fail(`Inventory store ${safeId(store.id)} has an unsupported kind.`);
    }
    requireNonemptyString(store.locator, "store locator");
    if (locators.has(store.locator)) {
      fail(`Inventory locator is duplicated: ${safeId(store.locator)}`);
    }
    locators.add(store.locator);
    requireArray(store.data_classes, "store data_classes");
    if (store.data_classes.length === 0) {
      fail(`Inventory store ${safeId(store.id)} needs a data class.`);
    }
    requireNonemptyString(store.deletion_status, "store deletion_status");
    if (store.real_data_boundary !== "production_only") {
      fail(`Inventory store ${safeId(store.id)} must be Production-only.`);
    }
    if (
      store.kind === "database_table" &&
      !/^app_private\.[a-z][a-z0-9_]*$/u.test(store.locator)
    ) {
      fail(`Inventory database locator is invalid: ${safeId(store.locator)}`);
    }
  }

  const actualSurfaceIds = new Set();
  for (const surface of value.surfaces) {
    validateEntry(surface, "surface", profileNames, ids);
    requireNonemptyString(surface.provider, "surface provider");
    requireNonemptyString(surface.release_status, "surface release_status");
    actualSurfaceIds.add(surface.id);
  }
  compareExact(
    "external surface identifiers",
    requiredSurfaceIds,
    actualSurfaceIds,
  );
}

function validateEntry(entry, label, profileNames, ids) {
  requireObject(entry, label);
  requireNonemptyString(entry.id, `${label} id`);
  requireNonemptyString(entry.purpose, `${label} purpose`);
  requireNonemptyString(entry.retention_profile, `${label} retention_profile`);
  requireNonemptyString(
    entry.real_data_boundary,
    `${label} real_data_boundary`,
  );
  if (ids.has(entry.id))
    fail(`Inventory ID is duplicated: ${safeId(entry.id)}`);
  ids.add(entry.id);
  if (!profileNames.has(entry.retention_profile)) {
    fail(`${safeId(entry.id)} references an unknown retention profile.`);
  }
}

function readLocalSupabaseStatus() {
  const localCli = resolve(
    projectRoot,
    "node_modules",
    "supabase",
    "dist",
    "supabase.js",
  );
  const command = existsSync(localCli)
    ? { program: process.execPath, args: [localCli] }
    : { program: "supabase", args: [] };
  const result = spawnSync(
    command.program,
    [...command.args, "status", "-o", "json"],
    {
      cwd: projectRoot,
      encoding: "utf8",
      windowsHide: true,
      maxBuffer: 2 * 1024 * 1024,
      timeout: localCommandTimeoutMs,
    },
  );
  if (result.error || result.status !== 0) {
    fail(
      "The local Supabase status is unavailable. Start the local stack first.",
    );
  }
  try {
    return JSON.parse(result.stdout);
  } catch {
    fail("The local Supabase status response was invalid.");
  }
}

function requireLoopbackDatabaseUrl(value) {
  if (typeof value !== "string") fail("The local database URL is unavailable.");
  const parsed = new URL(value);
  if (!new Set(["127.0.0.1", "localhost", "::1"]).has(parsed.hostname)) {
    fail("Inventory verification refuses non-loopback database targets.");
  }
  return value;
}

function compareExact(label, expectedValues, actualValues) {
  const expected = new Set(expectedValues);
  const actual = new Set(actualValues);
  const missing = [...actual].filter((item) => !expected.has(item)).sort();
  const extra = [...expected].filter((item) => !actual.has(item)).sort();
  if (missing.length > 0 || extra.length > 0) {
    const details = [];
    if (missing.length > 0)
      details.push(`missing inventory entries: ${missing.join(", ")}`);
    if (extra.length > 0)
      details.push(`stale inventory entries: ${extra.join(", ")}`);
    fail(`${label} do not match (${details.join("; ")}).`);
  }
}

function requireObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    fail(`${label} must be an object.`);
  }
}

function requireArray(value, label) {
  if (!Array.isArray(value)) fail(`${label} must be an array.`);
}

function requireNonemptyString(value, label) {
  if (typeof value !== "string" || value.trim() === "") {
    fail(`${label} must be a non-empty string.`);
  }
}

function safeId(value) {
  return typeof value === "string" && /^[a-zA-Z0-9:._-]+$/u.test(value)
    ? value
    : "invalid-identifier";
}

function fail(message) {
  console.error(`Production data inventory failed: ${message}`);
  process.exit(1);
}
