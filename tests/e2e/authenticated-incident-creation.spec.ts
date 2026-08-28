import { expect, test, type Page } from "@playwright/test";
import postgres from "postgres";

import {
  createLocalQualificationAccounts,
  type LocalQualificationAccounts,
} from "./support/local-qualification-account";

test.describe.configure({ mode: "serial" });

let accounts: LocalQualificationAccounts;

async function signIn(page: Page) {
  await page.goto("/login");
  await page
    .getByLabel("Employee number")
    .fill(accounts.officer.employeeNumber);
  await page.getByLabel("Passcode").fill(accounts.officer.passcode);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/home");
}

async function loadSavedFacts(): Promise<unknown[]> {
  const databaseUrl = process.env.SUPABASE_DB_URL;
  if (!databaseUrl)
    throw new Error("Missing local qualification database URL.");
  const sql = postgres(databaseUrl, {
    max: 1,
    prepare: false,
    idle_timeout: 5,
  });
  try {
    const [revision] = await sql<ReadonlyArray<{ reviewed_facts: unknown[] }>>`
      select revision.reviewed_facts
      from app_private.incident_revisions as revision
      join app_private.incidents as incident on incident.id = revision.incident_id
      where incident.incident_number = 'F-CREATE-001'
      order by revision.revision_number desc
      limit 1
    `;
    if (!revision)
      throw new Error("Fictional incident revision was not saved.");
    return revision.reviewed_facts;
  } finally {
    await sql.end({ timeout: 5 });
  }
}

test.beforeAll(async () => {
  accounts = await createLocalQualificationAccounts();
});

test("an officer confirms the category and every proposed fact before saving", async ({
  page,
}) => {
  test.setTimeout(60_000);
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

  await signIn(page);
  await page.goto("/incidents/new");
  await page
    .getByRole("button", { name: "Confirm officer relationships" })
    .click();
  await page.getByLabel("Incident number").fill("F-CREATE-001");
  await page.getByLabel("Incident name").fill("Fictional creation review");
  await page.getByLabel("Date and time occurred").fill("2026-08-27T12:00");
  await page.getByLabel("Location").fill("Fictional training room");
  await page
    .getByLabel("Incident category")
    .selectOption("incident_no_disciplinary");
  await page
    .getByLabel("Your field notes")
    .fill(
      "Fictional first source fact.\nFictional line that must stay out of reports.",
    );
  await expect(
    page.getByRole("heading", { name: "Proposed category" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Confirm category and review facts" })
    .click();

  await expect(
    page.getByRole("blockquote").filter({
      hasText: "Fictional first source fact.",
    }),
  ).toBeVisible();
  const firstProposal = page
    .getByRole("heading", { name: "Proposed fact 1" })
    .locator("..");
  await firstProposal.getByRole("button", { name: "Confirm fact" }).focus();
  await expect(
    firstProposal.getByRole("button", { name: "Confirm fact" }),
  ).toBeFocused();
  await firstProposal
    .getByRole("button", { name: "Confirm fact" })
    .press("Enter");

  const secondProposal = page
    .getByRole("heading", { name: "Proposed fact 2" })
    .locator("..");
  await secondProposal.getByRole("button", { name: "Do not use" }).click();
  await page
    .getByLabel("Information not yet known")
    .fill("Fictional missing detail.");
  await page
    .getByRole("button", { name: "Continue to missing information" })
    .click();

  await page
    .getByLabel(
      "What was the medical disposition for the inmate or inmates? answer",
    )
    .selectOption("N/A - no injuries reported");
  const investigation = page.locator("fieldset").filter({
    hasText: "Did an investigation occur? (Required)",
  });
  await investigation.getByRole("button", { name: "No", exact: true }).click();
  await page.getByRole("button", { name: "Review report types" }).click();
  await expect(
    page.getByText("1 confirmed note fact plus one explicit unknown"),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Continue to Forms & Export" })
    .click();

  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    )
    .toBe(true);
  await page.getByRole("button", { name: "Save incident" }).click();
  await expect(page.getByText(/Incident saved/)).toBeVisible();

  const facts = JSON.stringify(await loadSavedFacts());
  expect(facts).toContain("Fictional first source fact.");
  expect(facts).not.toContain("Fictional line that must stay out of reports.");
  expect(facts).toContain("Fictional missing detail.");
  expect(browserErrors).toEqual([]);
  expect(failedRequests).toEqual([]);
});
