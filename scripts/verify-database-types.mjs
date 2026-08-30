import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const generatedTypePath = resolve(
  repositoryRoot,
  "src/lib/supabase/database.generated.ts",
);
const localCliPath = resolve(
  repositoryRoot,
  "node_modules/supabase/dist/supabase.js",
);
const arguments_ = ["gen", "types", "typescript", "--local", "--schema", "api"];
const localCommandTimeoutMs = 15_000;

const generated = existsSync(localCliPath)
  ? spawnSync(process.execPath, [localCliPath, ...arguments_], {
      cwd: repositoryRoot,
      encoding: "utf8",
      maxBuffer: 4 * 1024 * 1024,
      timeout: localCommandTimeoutMs,
    })
  : spawnSync("supabase", arguments_, {
      cwd: repositoryRoot,
      encoding: "utf8",
      maxBuffer: 4 * 1024 * 1024,
      timeout: localCommandTimeoutMs,
    });

if (generated.error || generated.status !== 0 || !generated.stdout) {
  console.error(
    "Database types could not be generated from the isolated local database.",
  );
  process.exit(1);
}

const normalizedGenerated = `${generated.stdout.replaceAll("\r\n", "\n").trimEnd()}\n`;

if (process.argv.includes("--write")) {
  writeFileSync(generatedTypePath, normalizedGenerated, "utf8");
  console.log("Generated database types from the local api schema.");
  process.exit(0);
}

if (!existsSync(generatedTypePath)) {
  console.error(
    "Generated database types are missing. Run npm run db:types:generate.",
  );
  process.exit(1);
}

const committed = readFileSync(generatedTypePath, "utf8").replaceAll(
  "\r\n",
  "\n",
);
if (committed !== normalizedGenerated) {
  console.error(
    "Generated database types do not match the migrated local api schema. Run npm run db:types:generate and review the diff.",
  );
  process.exit(1);
}

console.log("Generated database types match the migrated local api schema.");
