import { readdirSync, readFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const RUNTIME_EXTENSIONS = new Set([
  ".cjs",
  ".js",
  ".jsx",
  ".mjs",
  ".ts",
  ".tsx",
]);
const APPROVED_SINK_PATH = "src/server/observability/safe-operational-event.ts";
const OUTPUT_PATTERNS = [
  /\bconsole\s*\.\s*(?:debug|dir|error|info|log|table|trace|warn)\s*\(/u,
  /\bprocess\s*\.\s*(?:stdout|stderr)\s*\.\s*write\s*\(/u,
];

export function verifyRuntimeLogging({ projectRoot = process.cwd() } = {}) {
  const sourceRoot = resolve(projectRoot, "src");
  const violations = [];

  for (const absolutePath of walk(sourceRoot)) {
    const repositoryPath = relative(projectRoot, absolutePath).replaceAll(
      "\\",
      "/",
    );
    if (
      !isRuntimeSource(repositoryPath) ||
      repositoryPath === APPROVED_SINK_PATH
    )
      continue;

    const lines = readFileSync(absolutePath, "utf8").split(/\r?\n/u);
    for (const [index, line] of lines.entries()) {
      if (OUTPUT_PATTERNS.some((pattern) => pattern.test(line))) {
        violations.push({ path: repositoryPath, line: index + 1 });
      }
    }
  }

  return { ok: violations.length === 0, violations };
}

function* walk(root) {
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = resolve(root, entry.name);
    if (entry.isDirectory()) yield* walk(path);
    else if (entry.isFile()) yield path;
  }
}

function isRuntimeSource(path) {
  if (path.includes("/__tests__/") || /\.(?:spec|test)\.[^.]+$/u.test(path))
    return false;
  const extension = /(?:\.[^.]+)$/u.exec(path)?.[0] ?? "";
  return RUNTIME_EXTENSIONS.has(extension);
}

function main() {
  const result = verifyRuntimeLogging();
  if (!result.ok) {
    console.error(
      "Runtime output must use the strict safe operational-event boundary:",
    );
    for (const violation of result.violations)
      console.error(`- ${violation.path}:${violation.line}`);
    process.exitCode = 1;
    return;
  }
  console.log("Runtime logging boundary passed.");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  main();
