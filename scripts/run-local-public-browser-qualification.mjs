import { spawn, spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

import { validateLocalBrowserQualificationRequest } from "./local-authenticated-browser-qualification-guard.mjs";

const repositoryRoot = resolve(import.meta.dirname, "..");
const supabaseCli = resolve(
  repositoryRoot,
  "node_modules",
  "supabase",
  "dist",
  "supabase.js",
);
const nextCli = resolve(
  repositoryRoot,
  "node_modules",
  "next",
  "dist",
  "bin",
  "next",
);
const playwrightCli = resolve(
  repositoryRoot,
  "node_modules",
  "@playwright",
  "test",
  "cli.js",
);
const publicBrowserQualificationSpecs = [
  "tests/e2e/accessibility.spec.ts",
  "tests/e2e/admin-retention.spec.ts",
  "tests/e2e/count-sheet.spec.ts",
  "tests/e2e/forms-library.spec.ts",
  "tests/e2e/foundation.spec.ts",
  "tests/e2e/report-print.spec.ts",
];
const port = Number(process.env.LOCAL_PUBLIC_BROWSER_PORT ?? "3111");
const origin = `http://127.0.0.1:${port}`;

function command(entry, args, options = {}) {
  return spawnSync(process.execPath, [entry, ...args], {
    cwd: repositoryRoot,
    encoding: options.capture ? "utf8" : undefined,
    env: options.env ?? process.env,
    stdio: options.capture ? ["ignore", "pipe", "pipe"] : "inherit",
    windowsHide: true,
  });
}

function readLocalSupabaseStatus() {
  const result = command(supabaseCli, ["status", "-o", "json"], {
    capture: true,
  });
  if (result.status !== 0) {
    throw new Error(
      "Local Supabase is not ready. Run npm run db:start and try again.",
    );
  }
  try {
    return JSON.parse(result.stdout);
  } catch {
    throw new Error("Local Supabase status could not be verified.");
  }
}

async function waitForServer(url, child) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (child.exitCode !== null)
      throw new Error(
        "The local public qualification server stopped before it was ready.",
      );
    try {
      const response = await fetch(url, { cache: "no-store" });
      if (response.ok) return;
    } catch {
      // The server is still starting.
    }
    await delay(250);
  }
  throw new Error(
    "The local public qualification server did not become ready.",
  );
}

function createQualificationEnvironment(target) {
  return {
    ...process.env,
    APP_ENV: "development",
    APP_ORIGIN: origin,
    AUTH_SESSION_ENCRYPTION_KEY: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: target.publishableKey,
    NEXT_PUBLIC_SUPABASE_URL: target.apiUrl,
    NEXT_TELEMETRY_DISABLED: "1",
    PLAYWRIGHT_BASE_URL: origin,
  };
}

let target;
try {
  target = validateLocalBrowserQualificationRequest({
    argv: process.argv.slice(2),
    status: readLocalSupabaseStatus(),
  });
} catch (error) {
  console.error(
    error instanceof Error
      ? error.message
      : "Local public qualification request rejected.",
  );
  process.exitCode = 1;
}

if (target) {
  const qualificationEnvironment = createQualificationEnvironment(target);
  const build = command(nextCli, ["build"], { env: qualificationEnvironment });
  if (build.status !== 0) {
    process.exitCode = 1;
  } else {
    const server = spawn(
      process.execPath,
      [nextCli, "start", "--hostname", "127.0.0.1", "--port", String(port)],
      {
        cwd: repositoryRoot,
        env: qualificationEnvironment,
        stdio: "inherit",
        windowsHide: true,
      },
    );
    try {
      await waitForServer(`${origin}/api/health/live`, server);
      const result = command(
        playwrightCli,
        [
          "test",
          ...publicBrowserQualificationSpecs,
          "--workers=1",
          "--retries=0",
        ],
        { env: qualificationEnvironment },
      );
      process.exitCode = result.status ?? 1;
    } catch (error) {
      console.error(
        error instanceof Error
          ? error.message
          : "Local public browser qualification failed.",
      );
      process.exitCode = 1;
    } finally {
      server.kill();
    }
  }
}
