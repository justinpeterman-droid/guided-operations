import { spawnSync } from "node:child_process";
import { createHmac, randomBytes, randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";

import { validateFictionalTestBootstrapRequest } from "./fictional-test-administrator-bootstrap-guard.mjs";

const repositoryRoot = resolve(import.meta.dirname, "..");
const environmentFile = resolve(repositoryRoot, ".env.local");
const fictionalAdministrator = {
  displayName: "Fictional Test Administrator",
  employeeNumber: "FICTIONAL-TEST-ADMIN",
  employeeNumberHint: "DMIN",
};
const temporaryPasscodeAlphabet =
  "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

function randomBase64UrlValue() {
  return randomBytes(32).toString("base64url");
}

function createTemporaryPasscode() {
  const bytes = randomBytes(20);
  return Array.from(
    bytes,
    (value) =>
      temporaryPasscodeAlphabet[value % temporaryPasscodeAlphabet.length],
  ).join("");
}

function employeeDigest(employeeNumber, pepper) {
  return createHmac("sha256", pepper)
    .update(employeeNumber.normalize("NFKC").trim().toUpperCase(), "utf8")
    .digest("hex");
}

async function addMissingLocalAuthSettings(environment) {
  const additions = {
    AUTH_SESSION_ENCRYPTION_KEY: randomBase64UrlValue(),
    CSRF_HMAC_KEY: randomBase64UrlValue(),
    EMPLOYEE_LOOKUP_PEPPER: randomBase64UrlValue(),
    INCIDENT_IDEMPOTENCY_HMAC_KEY: randomBase64UrlValue(),
  };
  const missing = Object.entries(additions).filter(
    ([name]) => !environment[name]?.trim(),
  );
  if (missing.length === 0) return environment;

  const existing = await readFile(environmentFile, "utf8");
  const suffix = missing.map(([name, value]) => `${name}=${value}`).join("\n");
  await writeFile(
    environmentFile,
    `${existing.endsWith("\n") ? existing : `${existing}\n`}${suffix}\n`,
    { encoding: "utf8", mode: 0o600 },
  );
  for (const [name, value] of missing) environment[name] = value;
  return environment;
}

function deliverTemporaryPasscodeToLocalClipboard(temporaryPasscode) {
  const deliveryScript = `
    Add-Type -AssemblyName System.Windows.Forms
    [System.Windows.Forms.Clipboard]::SetText($env:GUIDED_OPERATIONS_TEMPORARY_PASSCODE)
    $message = @'
A fictional test administrator is ready.

Employee number: ${fictionalAdministrator.employeeNumber}

Its temporary passcode is in your Windows clipboard. Paste it into the local Sign In screen, then change it immediately. Do not send the passcode in chat.

Click OK only after you have saved the code privately.
'@
    $choice = [System.Windows.Forms.MessageBox]::Show($message, "Guided Operations fictional test account", [System.Windows.Forms.MessageBoxButtons]::OKCancel, [System.Windows.Forms.MessageBoxIcon]::Information)
    if ($choice -eq [System.Windows.Forms.DialogResult]::OK) { exit 0 }
    [System.Windows.Forms.Clipboard]::Clear()
    exit 2
  `;
  const result = spawnSync(
    "powershell.exe",
    ["-NoProfile", "-Command", deliveryScript],
    {
      env: {
        ...process.env,
        GUIDED_OPERATIONS_TEMPORARY_PASSCODE: temporaryPasscode,
      },
      stdio: "ignore",
      windowsHide: true,
    },
  );
  return result.status === 0;
}

async function main() {
  const { loadEnvConfig } = nextEnv;
  loadEnvConfig(repositoryRoot);
  validateFictionalTestBootstrapRequest({
    argv: process.argv.slice(2),
    environment: process.env,
  });
  await addMissingLocalAuthSettings(process.env);

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SECRET_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
  const sql = postgres(process.env.SUPABASE_DB_URL, {
    max: 1,
    prepare: false,
    idle_timeout: 5,
    ssl: "require",
  });
  let authUserId;
  let staged = false;
  const temporaryPasscode = createTemporaryPasscode();
  const expiresAt = new Date(Date.now() + 30 * 60_000);

  try {
    const [accountCount] = await sql.unsafe(
      "select count(*)::integer as count from app_private.user_accounts",
    );
    if (Number(accountCount?.count) !== 0) {
      throw new Error("The shared fictional database is no longer empty.");
    }

    const created = await supabase.auth.admin.createUser({
      email: `go-fictional-test-${randomUUID()}@auth.invalid`,
      password: temporaryPasscode,
      email_confirm: true,
    });
    authUserId = created.data.user?.id;
    const signInAlias = created.data.user?.email;
    if (created.error || !authUserId || !signInAlias) {
      throw new Error("The fictional Auth user could not be created.");
    }

    const lookupDigest = employeeDigest(
      fictionalAdministrator.employeeNumber,
      process.env.EMPLOYEE_LOOKUP_PEPPER,
    );
    await sql.unsafe(
      "select app_private.bootstrap_first_administrator($1::uuid, $2::text, $3::text, $4::text, $5::text, $6::timestamptz)",
      [
        authUserId,
        lookupDigest,
        fictionalAdministrator.employeeNumberHint,
        fictionalAdministrator.displayName,
        signInAlias,
        expiresAt,
      ],
    );
    staged = true;

    if (!deliverTemporaryPasscodeToLocalClipboard(temporaryPasscode)) {
      throw new Error("Private temporary-passcode delivery was not accepted.");
    }
    await sql.unsafe(
      "select app_private.activate_bootstrapped_administrator($1::uuid)",
      [authUserId],
    );
    console.log(
      "Fictional test administrator activated; its passcode was delivered privately.",
    );
  } catch (error) {
    if (authUserId) {
      try {
        if (staged) {
          await sql.unsafe(
            "select app_private.abandon_bootstrapped_administrator($1::uuid)",
            [authUserId],
          );
        }
        await supabase.auth.admin.deleteUser(authUserId);
      } catch {
        // The command keeps the original non-sensitive error only.
      }
    }
    throw error;
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((error) => {
  console.error(
    error instanceof Error ? error.message : "Fictional test bootstrap failed.",
  );
  process.exitCode = 1;
});
