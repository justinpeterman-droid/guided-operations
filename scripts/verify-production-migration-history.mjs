import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const VERSION_PATTERN = /^\d{14}$/u;

export function verifyMigrationHistory(payload, expectedHead, requireComplete) {
  const migrations = Array.isArray(payload?.migrations)
    ? payload.migrations
    : [];
  const errors = [];
  const localVersions = [];
  const remoteVersions = [];

  for (const row of migrations) {
    const local = typeof row?.local === "string" ? row.local : "";
    const remote = typeof row?.remote === "string" ? row.remote : "";
    if (local) {
      if (!VERSION_PATTERN.test(local))
        errors.push("Invalid local migration version.");
      localVersions.push(local);
    }
    if (remote) {
      if (!VERSION_PATTERN.test(remote))
        errors.push("Invalid remote migration version.");
      remoteVersions.push(remote);
    }
    if (remote && local !== remote)
      errors.push(
        "Remote migration history is not represented by the candidate.",
      );
  }

  const sortedLocal = [...new Set(localVersions)].sort();
  const sortedRemote = [...new Set(remoteVersions)].sort();
  if (sortedLocal.at(-1) !== expectedHead)
    errors.push(
      "The candidate migration head is absent from the CLI inventory.",
    );
  if (sortedRemote.some((version, index) => sortedLocal[index] !== version))
    errors.push("Remote migration history is not an exact candidate prefix.");
  if (requireComplete && sortedRemote.at(-1) !== expectedHead)
    errors.push(
      "The production migration head did not reach the approved version.",
    );
  if (requireComplete && sortedRemote.length !== sortedLocal.length)
    errors.push("Production still has unapplied candidate migrations.");

  return {
    ok: errors.length === 0,
    errors,
    localCount: sortedLocal.length,
    remoteCount: sortedRemote.length,
    remoteHead: sortedRemote.at(-1) ?? null,
  };
}

function main() {
  const [filePath, expectedHead, mode] = process.argv.slice(2);
  if (!filePath || !expectedHead || !new Set(["before", "after"]).has(mode)) {
    console.error(
      "Usage: node scripts/verify-production-migration-history.mjs <json> <expected-head> <before|after>",
    );
    process.exit(1);
  }
  let payload;
  try {
    payload = JSON.parse(readFileSync(filePath, "utf8"));
  } catch {
    console.error("Production migration history could not be read.");
    process.exit(1);
  }
  const result = verifyMigrationHistory(
    payload,
    expectedHead,
    mode === "after",
  );
  if (!result.ok) {
    for (const error of result.errors)
      console.error(`Production migration history rejected: ${error}`);
    process.exit(1);
  }
  console.log(
    `Production migration history verified (${result.remoteCount}/${result.localCount}; target values withheld).`,
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  main();
