import { spawnSync } from "node:child_process";
import { createHmac, randomBytes } from "node:crypto";
import { resolve } from "node:path";

import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";

import { validateFictionalTestRotationRequest } from "./fictional-test-administrator-bootstrap-guard.mjs";

const repositoryRoot = resolve(import.meta.dirname, "..");
const fictionalAdministrator = {
  employeeNumber: "FICTIONAL-TEST-ADMIN",
  facilitySlug: "fictional-training-facility",
};
const temporaryPasscodeAlphabet =
  "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

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

function sessionCookies(response) {
  const setCookies = response.headers.getSetCookie?.() ?? [];
  return setCookies
    .map((value) => value.split(";", 1)[0])
    .filter((value) => /^go-auth-session(?:\.\d+)?=/.test(value));
}

async function verifyProviderAuthority({ alias, temporaryPasscode, supabase }) {
  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      db: { schema: "api" },
      auth: { autoRefreshToken: false, persistSession: false },
    },
  );
  const signIn = await client.auth.signInWithPassword({
    email: alias,
    password: temporaryPasscode,
  });
  if (signIn.error || !signIn.data.session || !signIn.data.user) {
    throw new Error("The fictional Auth sign-in verification failed.");
  }
  const claims = await client.auth.getClaims(signIn.data.session.access_token);
  const authority = claims.data?.claims?.app_metadata?.auth_version;
  if (claims.error || !Number.isInteger(authority) || authority < 1) {
    throw new Error(
      "The hosted custom access-token hook is not supplying session authority.",
    );
  }
  const account = await client.rpc("current_account");
  if (
    account.error ||
    !Array.isArray(account.data) ||
    account.data.length !== 1
  ) {
    const errorCode =
      typeof account.error === "object" &&
      account.error !== null &&
      "code" in account.error &&
      typeof account.error.code === "string" &&
      /^[A-Z0-9_]{1,32}$/.test(account.error.code)
        ? account.error.code
        : "UNKNOWN";
    throw new Error(
      `The fictional account session could not reach its private workspace (${errorCode}).`,
    );
  }

  // Keeps the server-only key referenced in the function's trusted inputs and
  // makes accidental replacement with a browser key obvious in review.
  if (!supabase)
    throw new Error("The fictional Auth administrator is unavailable.");
}

async function verifyLocalSessionFlow(temporaryPasscode) {
  const origin = process.env.APP_ORIGIN;
  const response = await fetch(`${origin}/api/auth/sign-in`, {
    method: "POST",
    redirect: "manual",
    headers: {
      Origin: origin,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      employeeNumber: fictionalAdministrator.employeeNumber,
      passcode: temporaryPasscode,
    }),
  });
  const cookies = sessionCookies(response);
  if (response.status !== 303 || cookies.length === 0) {
    throw new Error(
      "The local sign-in response did not set an encrypted session cookie.",
    );
  }
  const home = await fetch(`${origin}/home`, {
    headers: { Cookie: cookies.join("; ") },
  });
  const homeMarkup = await home.text();
  if (
    home.status !== 200 ||
    !homeMarkup.includes(
      "Change your temporary passcode to open your workspace.",
    )
  ) {
    throw new Error(
      `The local encrypted session cookie did not reach the temporary-passcode screen (HTTP ${home.status}).`,
    );
  }
}

async function main() {
  const { loadEnvConfig } = nextEnv;
  loadEnvConfig(repositoryRoot);
  validateFictionalTestRotationRequest({
    argv: process.argv.slice(2),
    environment: process.env,
  });

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
  const temporaryPasscode = createTemporaryPasscode();
  const expiresAt = new Date(Date.now() + 30 * 60_000);
  const employeeLookupDigest = employeeDigest(
    fictionalAdministrator.employeeNumber,
    process.env.EMPLOYEE_LOOKUP_PEPPER,
  );

  try {
    const accounts = await sql.unsafe(
      `select account.auth_user_id, account.sign_in_alias
       from app_private.user_accounts as account
       join app_private.staff_members as staff on staff.id = account.staff_member_id
       join app_private.facilities as facility on facility.id = staff.facility_id
       where staff.employee_lookup_hash = $1::text
         and facility.slug = $2::text
         and account.status = 'active'
         and staff.status = 'active'
       limit 2`,
      [employeeLookupDigest, fictionalAdministrator.facilitySlug],
    );
    if (accounts.length !== 1) {
      throw new Error(
        "The required fictional administrator was not available for rotation.",
      );
    }
    const account = accounts[0];

    const updated = await supabase.auth.admin.updateUserById(
      account.auth_user_id,
      {
        password: temporaryPasscode,
      },
    );
    if (updated.error) {
      throw new Error("The fictional Auth passcode could not be rotated.");
    }

    await sql.unsafe(
      `update app_private.user_accounts
         set must_change_passcode = true,
             temporary_passcode_expires_at = $2::timestamptz,
             auth_version = auth_version + 1
       where auth_user_id = $1::uuid
         and status = 'active'`,
      [account.auth_user_id, expiresAt],
    );
    await sql.unsafe(
      `insert into app_private.audit_events (
         facility_id, event_type, target_type, target_id, metadata
       )
       select staff.facility_id, 'account.passcode.reset.prepared', 'account', account.auth_user_id,
         jsonb_build_object('outcome', 'fictional_local_private_delivery_pending')
       from app_private.user_accounts as account
       join app_private.staff_members as staff on staff.id = account.staff_member_id
       where account.auth_user_id = $1::uuid`,
      [account.auth_user_id],
    );

    await verifyProviderAuthority({
      alias: account.sign_in_alias,
      temporaryPasscode,
      supabase,
    });
    await verifyLocalSessionFlow(temporaryPasscode);

    if (!deliverTemporaryPasscodeToLocalClipboard(temporaryPasscode)) {
      await supabase.auth.admin.updateUserById(account.auth_user_id, {
        password: createTemporaryPasscode(),
      });
      await sql.unsafe(
        `insert into app_private.audit_events (
           facility_id, event_type, target_type, target_id, metadata
         )
         select staff.facility_id, 'account.passcode.reset.prepared', 'account', account.auth_user_id,
           jsonb_build_object('outcome', 'fictional_local_private_delivery_cancelled')
         from app_private.user_accounts as account
         join app_private.staff_members as staff on staff.id = account.staff_member_id
         where account.auth_user_id = $1::uuid`,
        [account.auth_user_id],
      );
      throw new Error("Private temporary-passcode delivery was not accepted.");
    }
    console.log(
      "Fictional test administrator rotated and verified; its passcode was delivered privately.",
    );
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((error) => {
  console.error(
    error instanceof Error ? error.message : "Fictional test rotation failed.",
  );
  process.exitCode = 1;
});
