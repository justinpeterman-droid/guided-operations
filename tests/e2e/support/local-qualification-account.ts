import { createHmac, randomUUID } from "node:crypto";

import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";

export type LocalQualificationCredentials = Readonly<{
  employeeNumber: string;
  passcode: string;
}>;

const OFFICER_EMPLOYEE_NUMBER = "FICTIONAL-E2E-0001";
const OFFICER_PASSCODE = "FictionalLocalOfficerPasscode9!";
const ADMIN_EMPLOYEE_NUMBER = "FICTIONAL-E2E-ADMIN";
const ADMIN_PASSCODE = "FictionalLocalAdminPasscode9!";

function requiredEnvironment(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing local qualification setting: ${name}`);
  return value;
}

function employeeDigest(employeeNumber: string, pepper: string): string {
  return createHmac("sha256", pepper)
    .update(employeeNumber.normalize("NFKC").trim().toUpperCase(), "utf8")
    .digest("hex");
}

function assertLocalQualificationEnvironment() {
  const apiUrl = new URL(requiredEnvironment("NEXT_PUBLIC_SUPABASE_URL"));
  const databaseUrl = new URL(requiredEnvironment("SUPABASE_DB_URL"));
  if (
    process.env.LOCAL_AUTH_BROWSER_QUALIFICATION_ENABLED !== "true" ||
    process.env.APP_ENV !== "development" ||
    process.env.APP_ORIGIN !== "http://127.0.0.1:3109" ||
    apiUrl.origin !== "http://127.0.0.1:54321" ||
    databaseUrl.hostname !== "127.0.0.1" ||
    databaseUrl.port !== "54322" ||
    databaseUrl.pathname !== "/postgres"
  ) {
    throw new Error(
      "Fictional account setup is restricted to the guarded local qualification run.",
    );
  }
}

export async function createLocalQualificationOfficer(): Promise<LocalQualificationCredentials> {
  assertLocalQualificationEnvironment();
  const apiUrl = requiredEnvironment("NEXT_PUBLIC_SUPABASE_URL");
  const secretKey = requiredEnvironment("SUPABASE_SECRET_KEY");
  const databaseUrl = requiredEnvironment("SUPABASE_DB_URL");
  const pepper = requiredEnvironment("EMPLOYEE_LOOKUP_PEPPER");
  const adminClient = createClient(apiUrl, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const sql = postgres(databaseUrl, {
    max: 1,
    prepare: false,
    idle_timeout: 5,
  });

  try {
    const [accountCount] = await sql<ReadonlyArray<{ count: number }>>`
      select count(*)::integer as count
      from app_private.user_accounts
    `;
    if (accountCount?.count !== 0) {
      throw new Error(
        "Local qualification requires the clean database created by its guarded runner.",
      );
    }

    const adminAlias = `go-e2e-admin-${randomUUID()}@auth.invalid`;
    const adminUser = await adminClient.auth.admin.createUser({
      email: adminAlias,
      password: ADMIN_PASSCODE,
      email_confirm: true,
    });
    const adminUserId = adminUser.data.user?.id;
    if (adminUser.error || !adminUserId) {
      throw new Error(
        "The fictional local administrator could not be created.",
      );
    }

    const adminDigest = employeeDigest(ADMIN_EMPLOYEE_NUMBER, pepper);
    const expiresAt = new Date(Date.now() + 30 * 60_000);
    await sql`
      select app_private.bootstrap_first_administrator(
        ${adminUserId}::uuid,
        ${adminDigest},
        ${"MIN"},
        ${"Fictional Qualification Administrator"},
        ${adminAlias},
        ${expiresAt}
      )
    `;
    await sql`
      select app_private.activate_bootstrapped_administrator(
        ${adminUserId}::uuid
      )
    `;
    await sql`
      select app_private.complete_temporary_passcode_change(
        ${adminUserId}::uuid,
        ${adminDigest}
      )
    `;

    const officerAlias = `go-e2e-officer-${randomUUID()}@auth.invalid`;
    const officerUser = await adminClient.auth.admin.createUser({
      email: officerAlias,
      password: OFFICER_PASSCODE,
      email_confirm: true,
    });
    const officerUserId = officerUser.data.user?.id;
    if (officerUser.error || !officerUserId) {
      throw new Error("The fictional local officer could not be created.");
    }

    const officerDigest = employeeDigest(OFFICER_EMPLOYEE_NUMBER, pepper);
    await sql`
      select app_private.stage_invited_account(
        ${adminUserId}::uuid,
        ${officerUserId}::uuid,
        ${officerDigest},
        ${"0001"},
        ${"Fictional Qualification Officer"},
        ${"officer"}::app_private.account_role,
        ${"A"},
        ${officerAlias},
        ${expiresAt}
      )
    `;
    await sql`
      select app_private.activate_invited_account(
        ${adminUserId}::uuid,
        ${officerUserId}::uuid
      )
    `;
    await sql`
      select app_private.complete_temporary_passcode_change(
        ${officerUserId}::uuid,
        ${officerDigest}
      )
    `;

    return {
      employeeNumber: OFFICER_EMPLOYEE_NUMBER,
      passcode: OFFICER_PASSCODE,
    };
  } finally {
    await sql.end({ timeout: 5 });
  }
}
