import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

import postgres from "postgres";
import { corpusDatabaseTls } from "./policy-corpus-connection.mjs";

/**
 * Runs the policy-ingestion embedding command once per approved document
 * version. The embedding tool deliberately takes one version at a time; this
 * walks the list, shows progress, and keeps going when one document fails.
 *
 * Embedding is resumable by design - chunks that already have an embedding for
 * the profile are skipped - so subsequent runs recheck the stored embedding state. An interrupted
 * provider request can still incur cost before its result is persisted.
 *
 * Default mode counts only and sends nothing to OpenAI. Real embedding needs
 * --apply and --confirm-production-embedding.
 */

const TOOL_DIRECTORY = fileURLToPath(
  new URL("../tools/policy-ingestion", import.meta.url),
);

export function parseArguments(argv) {
  const options = { apply: false, confirmed: false, limit: 0 };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--apply") options.apply = true;
    else if (argument === "--confirm-production-embedding")
      options.confirmed = true;
    else if (argument === "--limit") {
      const value = argv[++index];
      if (!/^[1-9][0-9]{0,5}$/.test(value ?? ""))
        throw new Error("Invalid embedding limit");
      options.limit = Number(value);
    } else throw new Error("Unknown embedding option");
  }
  if (options.apply && !options.confirmed)
    throw new Error("Embedding requires explicit production confirmation");
  return options;
}

/** Counts how many documents finished, partly finished, or failed. */
export function summarize(results) {
  return {
    total: results.length,
    completed: results.filter((r) => r.status === "completed").length,
    failed: results.filter((r) => r.status === "failed").length,
    chunks: results.reduce((sum, r) => sum + (r.embedded ?? 0), 0),
  };
}

function line(text = "") {
  process.stdout.write(`${text}\n`);
}

export function runEmbedding(versionId, apply, run = spawnSync) {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      versionId,
    )
  )
    return { status: "failed", detail: "Invalid version identifier" };
  const args = [
    "run",
    "guided-policy-ingest",
    "embed",
    versionId,
    "--target-environment",
    "production",
    "--source-data",
    "controlled-policy",
    "--confirm-controlled-production-embedding",
  ];
  if (!apply) args.push("--dry-run");
  const result = run("uv", args, {
    cwd: TOOL_DIRECTORY,
    encoding: "utf8",
    shell: false,
    windowsHide: true,
  });
  const output = (result.stdout ?? "").trim();
  if (result.status !== 0)
    return {
      status: "failed",
      detail: "Embedding command did not complete with a valid result",
    };
  try {
    const parsed = JSON.parse(output);
    if (
      !parsed ||
      typeof parsed !== "object" ||
      Array.isArray(parsed) ||
      ["embedded", "eligible", "remaining", "skipped_existing"].some(
        (key) => !Number.isSafeInteger(parsed[key]) || parsed[key] < 0,
      )
    )
      throw new Error("Invalid embedding summary");
    return {
      status: "completed",
      embedded: parsed.embedded,
      eligible: parsed.eligible,
      remaining: parsed.remaining,
    };
  } catch {
    return {
      status: "failed",
      detail: "Embedding command did not complete with a valid result",
    };
  }
}

export async function main(argv = process.argv.slice(2)) {
  const options = parseArguments(argv);
  const databaseUrl = process.env.SUPABASE_DB_URL ?? "";
  if (!databaseUrl) {
    line("SUPABASE_DB_URL is required. Nothing was read or changed.");
    return 2;
  }

  const sql = postgres(databaseUrl, {
    max: 1,
    prepare: false,
    connect_timeout: 15,
    ssl: corpusDatabaseTls(databaseUrl),
  });

  let versions;
  try {
    versions = await sql`
      select distinct version.id::text as version_id
      from app_private.policy_document_versions as version
      join app_private.policy_documents as document
        on document.id = version.document_id
      join app_private.policy_ingestion_runs as run
        on run.document_version_id = version.id
      where document.status = 'approved'
        and run.status = 'ready'
        and run.qa_status = 'approved'
      order by version_id
    `;
  } finally {
    await sql.end({ timeout: 5 });
  }

  const queue = options.limit > 0 ? versions.slice(0, options.limit) : versions;
  line("");
  line(
    options.apply
      ? `EMBEDDING ${queue.length} document(s). This sends policy text to OpenAI.`
      : `COUNT ONLY - ${queue.length} document(s). Nothing is sent to OpenAI.`,
  );
  line("=".repeat(64));

  const results = [];
  for (const [index, version] of queue.entries()) {
    const position = `${index + 1}/${queue.length}`;
    const result = runEmbedding(version.version_id, options.apply);
    results.push(result);
    if (result.status === "completed") {
      const detail = options.apply
        ? `embedded ${result.embedded}`
        : `${result.eligible} eligible, ${result.remaining} to do`;
      line(`  ${position}  ${version.version_id} - ${detail}`);
    } else {
      line(`  ${position}  ${version.version_id} - FAILED`);
      line(`         ${result.detail.split("\n")[0]}`);
    }
  }

  const totals = summarize(results);
  line("");
  line(`Documents processed : ${totals.total}`);
  line(`Succeeded           : ${totals.completed}`);
  line(`Failed              : ${totals.failed}`);
  if (options.apply) line(`Chunks embedded     : ${totals.chunks}`);
  line("");
  if (!options.apply)
    line(
      "To embed for real, run the same command with --apply --confirm-production-embedding added.",
    );
  else if (totals.failed > 0)
    line(
      "Re-run to retry the failures. Finished work is skipped, not repeated.",
    );
  return totals.failed > 0 ? 1 : 0;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    process.exitCode = await main();
  } catch {
    console.error(
      "Corpus embedding could not complete. No database or provider details are logged.",
    );
    process.exitCode = 1;
  }
}
