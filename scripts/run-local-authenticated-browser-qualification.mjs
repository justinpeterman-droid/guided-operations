import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

import { validateLocalBrowserQualificationRequest } from "./local-authenticated-browser-qualification-guard.mjs";

const repositoryRoot = resolve(import.meta.dirname, "..");
const supabaseCli = resolve(
  repositoryRoot,
  "node_modules",
  "supabase",
  "dist",
  "supabase.js",
);
const playwrightCli = resolve(
  repositoryRoot,
  "node_modules",
  "@playwright",
  "test",
  "cli.js",
);

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

function resetLocalDatabase() {
  const result = command(supabaseCli, ["db", "reset"]);
  if (result.status !== 0) {
    throw new Error("The guarded local database reset failed.");
  }
}

let target;
try {
  target = validateLocalBrowserQualificationRequest({
    argv: process.argv.slice(2),
    status: readLocalSupabaseStatus(),
  });
} catch (error) {
  console.error(error instanceof Error ? error.message : "Request rejected.");
  process.exitCode = 1;
}

if (target) {
  const qualificationEnvironment = {
    ...process.env,
    AI_GENERATION_ENABLED: "false",
    APP_ENV: "development",
    APP_ORIGIN: "http://127.0.0.1:3109",
    AUTH_DUMMY_ALIAS: "fictional-dummy-local@auth.invalid",
    AUTH_SIGN_IN_ENABLED: "true",
    CSRF_HMAC_KEY: "fictional-local-only-csrf-hmac-key-qualification-v1",
    EMPLOYEE_LOOKUP_PEPPER:
      "fictional-local-only-employee-lookup-pepper-qualification-v1",
    INCIDENT_IDEMPOTENCY_HMAC_KEY:
      "fictional-local-only-incident-idempotency-key-qualification-v1",
    LOCAL_AUTH_BROWSER_QUALIFICATION_ENABLED: "true",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: target.publishableKey,
    NEXT_PUBLIC_SUPABASE_URL: target.apiUrl,
    NEXT_TELEMETRY_DISABLED: "1",
    OPENAI_API_KEY: "fictional-local-disabled-openai-key",
    OPENAI_EMBEDDING_MODEL: "fictional-local-disabled-model",
    OPENAI_POLICY_MODEL: "fictional-local-disabled-model",
    OPENAI_REPORT_DRAFT_MODEL: "fictional-local-disabled-model",
    PLAYWRIGHT_PORT: "3109",
    SAFE_OPERATIONAL_LOGGING_ENABLED: "false",
    SUPABASE_DB_URL: target.databaseUrl,
    SUPABASE_SECRET_KEY: target.secretKey,
  };
  delete qualificationEnvironment.PLAYWRIGHT_BASE_URL;

  let testStatus = 1;
  let cleanupStatus = 1;
  try {
    resetLocalDatabase();
    const result = command(
      playwrightCli,
      ["test", "tests/e2e/authenticated-count-sheet.spec.ts", "--workers=1"],
      { env: qualificationEnvironment },
    );
    testStatus = result.status ?? 1;
  } catch (error) {
    console.error(
      error instanceof Error
        ? error.message
        : "Local browser qualification failed.",
    );
  } finally {
    try {
      resetLocalDatabase();
      cleanupStatus = 0;
    } catch (error) {
      console.error(
        error instanceof Error
          ? error.message
          : "Local qualification cleanup failed.",
      );
    }
  }

  process.exitCode = testStatus === 0 && cleanupStatus === 0 ? 0 : 1;
}
