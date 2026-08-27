import { randomUUID } from "node:crypto";

import { expect, test, type Page } from "@playwright/test";
import postgres from "postgres";

import {
  createLocalQualificationAccounts,
  type LocalQualificationAccounts,
  type LocalQualificationCredentials,
} from "./support/local-qualification-account";

test.describe.configure({ mode: "serial" });

let accounts: LocalQualificationAccounts;
let incidentId: string;

async function signIn(page: Page, credentials: LocalQualificationCredentials) {
  await page.goto("/login");
  await page.getByLabel("Employee number").fill(credentials.employeeNumber);
  await page.getByLabel("Passcode").fill(credentials.passcode);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/home");
}

async function signOut(page: Page) {
  await page.goto("/account");
  await page.getByRole("button", { name: "Sign out of this browser" }).click();
  await page.waitForURL("**/login");
}

async function createFictionalIncident(): Promise<string> {
  const databaseUrl = process.env.SUPABASE_DB_URL;
  if (!databaseUrl)
    throw new Error("Missing local qualification database URL.");
  const sql = postgres(databaseUrl, {
    max: 1,
    prepare: false,
    idle_timeout: 5,
  });

  try {
    const [officer] = await sql<
      ReadonlyArray<{
        auth_user_id: string;
        facility_id: string;
        staff_member_id: string;
      }>
    >`
      select
        account.auth_user_id,
        staff.facility_id,
        staff.id as staff_member_id
      from app_private.user_accounts as account
      join app_private.staff_members as staff
        on staff.id = account.staff_member_id
      where staff.display_name = 'Fictional Qualification Officer'
        and account.status = 'active'
        and staff.status = 'active'
    `;
    if (!officer)
      throw new Error("Fictional qualification officer is missing.");

    const sourceNoteId = randomUUID();
    const officerFactId = randomUUID();
    const unassignedFactId = randomUUID();
    const fieldNotes = [
      {
        id: sourceNoteId,
        text: "Fictional raw note that must not reach the report workspace.",
        recordedAt: "2026-08-27T12:00:00.000Z",
      },
    ];
    const reviewedFacts = [
      {
        id: officerFactId,
        field: "Officer observation",
        state: "confirmed",
        value: "Fictional confirmed fact assigned to the reporting officer.",
        sourceNoteIds: [sourceNoteId],
        reportingStaffMemberIds: [officer.staff_member_id],
      },
      {
        id: unassignedFactId,
        field: "Unassigned observation",
        state: "confirmed",
        value: "Fictional confirmed fact that is not assigned to any reporter.",
        sourceNoteIds: [sourceNoteId],
        reportingStaffMemberIds: [],
      },
    ];

    return await sql.begin(async (transaction) => {
      const [incident] = await transaction<ReadonlyArray<{ id: string }>>`
        insert into app_private.incidents (
          facility_id,
          created_by_account_id,
          incident_number,
          display_name,
          occurred_at,
          category
        ) values (
          ${officer.facility_id}::uuid,
          ${officer.auth_user_id}::uuid,
          'F-WORKSPACE-001',
          'Fictional Report Workspace Qualification',
          '2026-08-27T12:00:00.000Z'::timestamptz,
          'training'
        )
        returning id
      `;
      if (!incident) throw new Error("Fictional incident was not created.");

      const [revision] = await transaction<ReadonlyArray<{ id: string }>>`
        insert into app_private.incident_revisions (
          incident_id,
          revision_number,
          editor_account_id,
          schema_version,
          field_notes,
          reviewed_facts
        ) values (
          ${incident.id}::uuid,
          1,
          ${officer.auth_user_id}::uuid,
          2,
          ${transaction.json(fieldNotes)},
          ${transaction.json(reviewedFacts)}
        )
        returning id
      `;
      if (!revision) throw new Error("Fictional revision was not created.");

      await transaction`
        insert into app_private.incident_staff_relationships (
          incident_revision_id,
          staff_member_id,
          relationship,
          selected_by_account_id
        ) values
          (
            ${revision.id}::uuid,
            ${officer.staff_member_id}::uuid,
            'reporting_officer',
            ${officer.auth_user_id}::uuid
          ),
          (
            ${revision.id}::uuid,
            ${officer.staff_member_id}::uuid,
            'preparer',
            ${officer.auth_user_id}::uuid
          )
      `;

      return incident.id;
    });
  } finally {
    await sql.end({ timeout: 5 });
  }
}

test.beforeAll(async () => {
  accounts = await createLocalQualificationAccounts();
  incidentId = await createFictionalIncident();
});

test("an officer and administrator can use the protected per-officer report workspace", async ({
  page,
}) => {
  const browserErrors: string[] = [];
  const failedRequests: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });
  page.on("pageerror", (error) => browserErrors.push(error.message));
  page.on("requestfailed", (request) => {
    const failure = request.failure()?.errorText ?? "unknown network failure";
    if (!failure.includes("ERR_ABORTED")) {
      failedRequests.push(`${request.url()}: ${failure}`);
    }
  });

  await signIn(page, accounts.officer);
  await page.goto("/reports");
  await page.getByRole("link", { name: "F-WORKSPACE-001" }).click();
  await expect(page).toHaveURL(`/incidents/${incidentId}`);
  await expect(
    page.getByRole("heading", {
      name: "Fictional Report Workspace Qualification",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("radio", { name: /Fictional Qualification Officer/ }),
  ).toBeChecked();
  await expect(page.getByText("Officer observation")).toBeVisible();
  await expect(page.getByText("Unassigned observation")).toHaveCount(0);
  await expect(page.getByText(/raw note that must not reach/)).toHaveCount(0);

  const checkbox = page.getByRole("checkbox", {
    name: /Officer observation/,
  });
  const checkboxBox = await checkbox.boundingBox();
  expect(checkboxBox?.width).toBeLessThan(30);
  expect(checkboxBox?.height).toBeLessThan(30);
  await checkbox.focus();
  await expect(checkbox).toBeFocused();
  await checkbox.press("Space");
  await expect(
    page.getByRole("button", { name: "Create review draft" }),
  ).toBeEnabled();

  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    )
    .toBe(true);

  await signOut(page);
  await signIn(page, accounts.administrator);
  await page.goto(`/incidents/${incidentId}`);
  await expect(
    page.getByRole("heading", {
      name: "Fictional Report Workspace Qualification",
    }),
  ).toBeVisible();
  await expect(page.getByText("Officer observation")).toBeVisible();
  await expect(page.getByText("Unassigned observation")).toHaveCount(0);
  await signOut(page);

  expect(browserErrors).toEqual([]);
  expect(failedRequests).toEqual([]);
});
