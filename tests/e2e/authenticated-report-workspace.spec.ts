import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";

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
let candidateId: string;

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

async function createFictionalIncident(): Promise<{
  incidentId: string;
  candidateId: string;
}> {
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

      const [candidate] = await transaction<ReadonlyArray<{ id: string }>>`
        insert into app_private.report_draft_candidates (
          incident_id,
          source_incident_revision_id,
          requested_by_account_id,
          reporting_staff_member_id,
          report_type,
          source_fact_ids,
          paragraphs,
          provider_key
        ) values (
          ${incident.id}::uuid,
          ${revision.id}::uuid,
          ${officer.auth_user_id}::uuid,
          ${officer.staff_member_id}::uuid,
          'first_person',
          ${[officerFactId]}::uuid[],
          ${transaction.json([
            {
              text: "Fictional generated sentence for officer review.",
              sourceFactIds: [officerFactId],
            },
          ])},
          'fictional.local'
        )
        returning id
      `;
      if (!candidate)
        throw new Error("Fictional report candidate was not created.");

      return { incidentId: incident.id, candidateId: candidate.id };
    });
  } finally {
    await sql.end({ timeout: 5 });
  }
}

async function appendFictionalCompetingRevision(
  reportId: string,
  narrative: string,
): Promise<void> {
  const databaseUrl = process.env.SUPABASE_DB_URL;
  if (!databaseUrl)
    throw new Error("Missing local qualification database URL.");
  const sql = postgres(databaseUrl, {
    max: 1,
    prepare: false,
    idle_timeout: 5,
  });

  try {
    const [revision] = await sql<ReadonlyArray<{ revision_number: number }>>`
      insert into app_private.report_revisions (
        report_id,
        revision_number,
        editor_account_id,
        source_incident_revision_id,
        narrative,
        reason,
        schema_version,
        provenance
      )
      select
        report.id,
        report.current_revision_number + 1,
        report.reporting_account_id,
        current_revision.source_incident_revision_id,
        ${narrative},
        'Fictional current correction.',
        current_revision.schema_version,
        jsonb_build_object(
          'prior_revision_number',
          report.current_revision_number
        )
      from app_private.reports as report
      join app_private.report_revisions as current_revision
        on current_revision.report_id = report.id
        and current_revision.revision_number = report.current_revision_number
      where report.id = ${reportId}::uuid
      returning revision_number
    `;
    if (revision?.revision_number !== 3)
      throw new Error("Fictional competing revision was not created.");
  } finally {
    await sql.end({ timeout: 5 });
  }
}

test.beforeAll(async () => {
  accounts = await createLocalQualificationAccounts();
  const qualification = await createFictionalIncident();
  incidentId = qualification.incidentId;
  candidateId = qualification.candidateId;
});

test("an officer and administrator can use the protected per-officer report workspace", async ({
  page,
}) => {
  test.setTimeout(60_000);
  const browserErrors: string[] = [];
  const failedRequests: string[] = [];
  let expectingRevisionConflict = false;
  const trackBrowserFailures = (trackedPage: Page) => {
    trackedPage.on("console", (message) => {
      if (message.type() !== "error") return;
      if (
        expectingRevisionConflict &&
        message.text().includes("409 (Conflict)")
      )
        return;
      browserErrors.push(message.text());
    });
    trackedPage.on("pageerror", (error) => browserErrors.push(error.message));
    trackedPage.on("requestfailed", (request) => {
      const failure = request.failure()?.errorText ?? "unknown network failure";
      if (!failure.includes("ERR_ABORTED")) {
        failedRequests.push(`${request.url()}: ${failure}`);
      }
    });
  };
  trackBrowserFailures(page);

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

  const finalNarrative =
    "Fictional officer-reviewed narrative created during local qualification.";
  await page.goto(`/reports/drafts/${candidateId}`);
  await expect(
    page.getByRole("heading", { name: "Review every drafted statement." }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("article")
      .getByText("Fictional generated sentence for officer review."),
  ).toBeVisible();
  await page.getByLabel("Final narrative").fill(finalNarrative);
  await page
    .getByLabel(
      "I reviewed this narrative and am submitting it as my own final report.",
    )
    .check();
  await page.getByRole("button", { name: "Create final report" }).click();
  await page.waitForURL(/\/reports\/[0-9a-f-]+$/);

  const reportUrl = new URL(page.url());
  const reportId = reportUrl.pathname.split("/").at(-1);
  expect(reportId).toMatch(/^[0-9a-f-]{36}$/);
  if (!reportId) throw new Error("Fictional report ID is missing.");
  await expect(page.getByText("Revision 1 · first_person")).toBeVisible();
  await expect(
    page
      .locator(
        'article[aria-label="Final report narrative"] .draft-review-copy > p',
      )
      .filter({ hasText: finalNarrative }),
  ).toBeVisible();

  const firstCorrection =
    "Fictional corrected narrative preserved as revision two.";
  await page.getByLabel("Corrected narrative").fill(firstCorrection);
  await page
    .getByLabel("Correction reason")
    .fill("Fictional wording correction.");
  await page.getByRole("button", { name: "Create corrected revision" }).click();
  await expect(page.getByText("Revision 2 · first_person")).toBeVisible();
  await expect(
    page
      .locator(
        'article[aria-label="Final report narrative"] .draft-review-copy > p',
      )
      .filter({ hasText: firstCorrection }),
  ).toBeVisible();

  const currentCorrection =
    "Fictional current narrative preserved as revision three.";
  await appendFictionalCompetingRevision(reportId, currentCorrection);

  const staleCorrection =
    "Fictional stale local work that must remain visible after conflict.";
  await page.getByLabel("Corrected narrative").fill(staleCorrection);
  await page
    .getByLabel("Correction reason")
    .fill("Fictional stale correction.");
  const staleRevisionResponse = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      response.url().endsWith(`/reports/${reportId}/revisions`),
  );
  expectingRevisionConflict = true;
  await page.getByRole("button", { name: "Create corrected revision" }).click();
  expect((await staleRevisionResponse).status()).toBe(409);
  await expect(
    page.getByText(/A newer revision was saved.*still here/),
  ).toBeVisible();
  await expect(page.getByLabel("Corrected narrative")).toHaveValue(
    staleCorrection,
  );
  expectingRevisionConflict = false;
  await page.reload();
  await expect(page.getByText("Revision 3 · first_person")).toBeVisible();
  await expect(
    page
      .locator(
        'article[aria-label="Final report narrative"] .draft-review-copy > p',
      )
      .filter({ hasText: currentCorrection }),
  ).toBeVisible();

  const revisionOne = page.getByRole("listitem").filter({
    has: page.getByText("Revision 1", { exact: true }),
  });
  await revisionOne
    .getByRole("button", { name: "Restore this version" })
    .click();
  await page
    .getByLabel("Restore reason")
    .fill("Fictional recovery of the officer-reviewed version.");
  await page.getByRole("button", { name: "Create restored revision" }).click();
  await expect(page.getByText("Revision 4 · first_person")).toBeVisible();
  await expect(
    page
      .locator(
        'article[aria-label="Final report narrative"] .draft-review-copy > p',
      )
      .filter({ hasText: finalNarrative }),
  ).toBeVisible();
  await expect(page.getByText("Restored from revision 1.")).toBeVisible();

  const [currentDownload, currentDownloadResponse] = await Promise.all([
    page.waitForEvent("download"),
    page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        response.url().endsWith(`/export-docx?revision=4`),
    ),
    page.getByRole("button", { name: "Download current Word file" }).click(),
  ]);
  expect(currentDownloadResponse.status()).toBe(200);
  expect(currentDownloadResponse.headers()["x-report-revision"]).toBe("4");
  expect(currentDownload.suggestedFilename()).toBe(
    `report-${reportId}-revision-4.docx`,
  );
  const currentDownloadPath = await currentDownload.path();
  if (!currentDownloadPath) throw new Error("Fictional DOCX path is missing.");
  const currentDownloadBytes = await readFile(currentDownloadPath);
  expect(currentDownloadBytes.subarray(0, 4).toString("hex")).toBe("504b0304");
  expect(currentDownloadBytes.byteLength).toBeGreaterThan(1_000);
  await expect(page.getByText("Downloaded report revision 4.")).toBeVisible();

  const historicalRevisionOne = page.getByRole("listitem").filter({
    has: page.getByText("Revision 1", { exact: true }),
  });
  const [historicalDownload, historicalDownloadResponse] = await Promise.all([
    page.waitForEvent("download"),
    page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        response.url().endsWith(`/export-docx?revision=1`),
    ),
    historicalRevisionOne
      .getByRole("button", { name: "Download this version" })
      .click(),
  ]);
  expect(historicalDownloadResponse.status()).toBe(200);
  expect(historicalDownloadResponse.headers()["x-report-revision"]).toBe("1");
  expect(historicalDownload.suggestedFilename()).toBe(
    `report-${reportId}-revision-1.docx`,
  );

  await page.evaluate(() => {
    window.print = () => {
      document.documentElement.dataset.reportPrintInvoked = "true";
    };
  });
  await page.getByRole("button", { name: "Print current report" }).click();
  await expect(
    page.getByText(/Print request recorded.*Opening the browser print dialog/),
  ).toBeVisible();
  await expect
    .poll(() => page.locator("html").getAttribute("data-report-print-invoked"))
    .toBe("true");

  await signOut(page);
  await signIn(page, accounts.administrator);
  await page.goto("/reports");
  const completedReportRow = page
    .getByRole("row")
    .filter({ hasText: "F-WORKSPACE-001" })
    .filter({ hasText: "First-person report" });
  await expect(completedReportRow).toBeVisible();
  await completedReportRow
    .getByRole("link", { name: "First-person report" })
    .click();
  await expect(page).toHaveURL(`/reports/${reportId}`);
  await expect(
    page
      .locator(
        'article[aria-label="Final report narrative"] .draft-review-copy > p',
      )
      .filter({ hasText: finalNarrative }),
  ).toBeVisible();

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
