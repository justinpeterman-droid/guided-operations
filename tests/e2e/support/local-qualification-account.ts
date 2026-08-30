import { createHmac, randomUUID } from "node:crypto";

import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";

export type LocalQualificationCredentials = Readonly<{
  employeeNumber: string;
  passcode: string;
}>;

export type LocalQualificationAccounts = Readonly<{
  administrator: LocalQualificationCredentials;
  lockedOfficer: LocalQualificationCredentials;
  officer: LocalQualificationCredentials;
}>;

const OFFICER_EMPLOYEE_NUMBER = "FICTIONAL-E2E-0001";
const OFFICER_PASSCODE = "FictionalLocalOfficerPasscode9!";
const ADMIN_EMPLOYEE_NUMBER = "FICTIONAL-E2E-ADMIN";
const ADMIN_PASSCODE = "FictionalLocalAdminPasscode9!";
const LOCKED_OFFICER_EMPLOYEE_NUMBER = "FICTIONAL-E2E-LOCKED";
const LOCKED_OFFICER_PASSCODE = "FictionalLocalLockedPasscode9!";

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

export async function createLocalQualificationAccounts(): Promise<LocalQualificationAccounts> {
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

    const dummyAlias = requiredEnvironment("AUTH_DUMMY_ALIAS");
    const dummyUser = await adminClient.auth.admin.createUser({
      email: dummyAlias,
      password: `FictionalDummyOnly9!${randomUUID()}`,
      email_confirm: true,
    });
    if (dummyUser.error || !dummyUser.data.user?.id) {
      throw new Error(
        "The fictional local timing-defense identity could not be created.",
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
    const fictionalDailyStructure = {
      schema_version: 1,
      layout: "fictional-browser-qualification-only",
    };
    const fictionalDailySchema = {
      schema_version: 1,
      fields: [
        {
          key: "supervisor",
          label: "Fictional supervisor",
          type: "text",
          required: true,
          max_length: 100,
        },
        {
          key: "completed",
          label: "Completed",
          type: "boolean",
          required: false,
        },
      ],
      tables: [
        {
          key: "entries",
          label: "Fictional assignment entries",
          min_rows: 0,
          max_rows: 4,
          columns: [
            {
              key: "post",
              label: "Fictional post",
              type: "text",
              required: true,
              max_length: 80,
            },
            {
              key: "status",
              label: "Status",
              type: "select",
              required: true,
              options: ["Ready", "Needs review"],
            },
          ],
        },
      ],
    };
    const [templateValidation] = await sql<
      ReadonlyArray<{ schema_valid: boolean; structure_version: string | null }>
    >`
      select
        app_private.valid_daily_paperwork_field_schema(
          ${sql.json(fictionalDailySchema)}::jsonb
        ) as schema_valid,
        ${sql.json(fictionalDailyStructure)}::jsonb ->> 'schema_version' as structure_version
    `;
    if (!templateValidation?.schema_valid)
      throw new Error("The fictional Daily Paperwork field schema is invalid.");
    if (templateValidation.structure_version !== "1")
      throw new Error("The fictional Daily Paperwork structure is invalid.");
    await sql`
      insert into app_private.form_templates (
        facility_id, template_code, title, version, source_authority,
        source_revision, source_sha256, rights_status, print_orientation,
        capabilities, structure, field_schema, active_from, approved_at,
        approved_by_account_id
      )
      select facility.id, 'assignment_roster',
        'Fictional Training Assignment Roster', 1,
        'Fictional Browser Qualification', 'FICTIONAL-E2E-V1',
        ${"a".repeat(64)}, 'approved_internal_use', 'landscape',
        array['screen', 'print']::text[], ${sql.json(fictionalDailyStructure)}::jsonb,
        ${sql.json(fictionalDailySchema)}::jsonb, date '2026-01-01',
        statement_timestamp(), ${adminUserId}::uuid
      from app_private.facilities as facility
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

    const lockedOfficerAlias = `go-e2e-locked-${randomUUID()}@auth.invalid`;
    const lockedOfficerUser = await adminClient.auth.admin.createUser({
      email: lockedOfficerAlias,
      password: LOCKED_OFFICER_PASSCODE,
      email_confirm: true,
    });
    const lockedOfficerUserId = lockedOfficerUser.data.user?.id;
    if (lockedOfficerUser.error || !lockedOfficerUserId) {
      throw new Error("The fictional locked officer could not be created.");
    }

    const lockedOfficerDigest = employeeDigest(
      LOCKED_OFFICER_EMPLOYEE_NUMBER,
      pepper,
    );
    await sql`
      select app_private.stage_invited_account(
        ${adminUserId}::uuid,
        ${lockedOfficerUserId}::uuid,
        ${lockedOfficerDigest},
        ${"LOCK"},
        ${"Fictional Locked Officer"},
        ${"officer"}::app_private.account_role,
        ${"D"},
        ${lockedOfficerAlias},
        ${expiresAt}
      )
    `;
    await sql`
      select app_private.activate_invited_account(
        ${adminUserId}::uuid,
        ${lockedOfficerUserId}::uuid
      )
    `;
    await sql`
      select app_private.complete_temporary_passcode_change(
        ${lockedOfficerUserId}::uuid,
        ${lockedOfficerDigest}
      )
    `;
    await sql`
      update app_private.user_accounts
      set status = 'locked', failed_attempts = 5,
          locked_until = statement_timestamp() + interval '30 minutes'
      where auth_user_id = ${lockedOfficerUserId}::uuid
    `;

    return {
      administrator: {
        employeeNumber: ADMIN_EMPLOYEE_NUMBER,
        passcode: ADMIN_PASSCODE,
      },
      lockedOfficer: {
        employeeNumber: LOCKED_OFFICER_EMPLOYEE_NUMBER,
        passcode: LOCKED_OFFICER_PASSCODE,
      },
      officer: {
        employeeNumber: OFFICER_EMPLOYEE_NUMBER,
        passcode: OFFICER_PASSCODE,
      },
    };
  } finally {
    await sql.end({ timeout: 5 });
  }
}

export async function createLocalQualificationOfficer(): Promise<LocalQualificationCredentials> {
  return (await createLocalQualificationAccounts()).officer;
}
