import { expect, test, type Page } from "@playwright/test";

import {
  createLocalQualificationAccounts,
  type LocalQualificationAccounts,
  type LocalQualificationCredentials,
} from "./support/local-qualification-account";

test.describe.configure({ mode: "serial" });

let accounts: LocalQualificationAccounts;

test.beforeAll(async () => {
  accounts = await createLocalQualificationAccounts();
});

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

test("an officer cannot open administrator pages", async ({ page }) => {
  await signIn(page, accounts.officer);

  for (const path of [
    "/admin",
    "/admin/accounts",
    "/admin/audit",
    "/admin/health",
    "/admin/retention",
  ]) {
    await page.goto(path);
    await expect(
      page.getByRole("heading", { name: "Administrator access is required." }),
    ).toBeVisible();
  }

  await signOut(page);
});

test("a fictional administrator uses the protected roster and status pages", async ({
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

  await signIn(page, accounts.administrator);
  await page.goto("/admin");
  await expect(
    page.getByRole("heading", {
      name: "Support the team without losing the safeguards.",
    }),
  ).toBeVisible();

  await page.getByRole("link", { name: "View accounts" }).click();
  await expect(
    page.getByRole("heading", { name: "Accounts and roster" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "Fictional Qualification Administrator",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Fictional Qualification Officer" }),
  ).toBeVisible();

  await page.getByLabel("Employee number").fill("FICTIONAL-E2E-NEW-0002");
  await page.getByLabel("Name").fill("Fictional Invited Officer");
  await page.getByLabel("Account type").selectOption("officer");
  await page.getByLabel("Assigned shift").selectOption("B");
  await page
    .getByLabel("Your administrator passcode")
    .fill(accounts.administrator.passcode);
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(
    page.getByRole("heading", {
      name: "Give this passcode to employee ending 0002",
    }),
  ).toBeVisible();
  const temporaryPasscode = page.locator(".account-session-message strong");
  await expect(temporaryPasscode).toHaveText(/^[A-HJ-NP-Za-km-z2-9]{20}$/);
  await expect(
    page.getByRole("heading", { name: "Fictional Invited Officer" }),
  ).toBeVisible();
  await expect(page.getByText(/Officer · active · shift B/)).toBeVisible();
  await page.getByRole("button", { name: "I have handed it over" }).click();

  await page.goto("/admin/audit");
  await expect(
    page.getByRole("heading", { name: "Activity log" }),
  ).toBeVisible();

  await page.goto("/admin/health");
  await expect(
    page.getByRole("heading", { name: "System health" }),
  ).toBeVisible();
  await expect(page.getByText("Supabase connection")).toBeVisible();

  await page.goto("/admin/retention");
  await expect(
    page.getByRole("heading", { name: "Retention and legal holds" }),
  ).toBeVisible();
  await expect(
    page.getByText("No records have reached the two-year review date."),
  ).toBeVisible();

  await signOut(page);
  expect(browserErrors).toEqual([]);
  expect(failedRequests).toEqual([]);
});
