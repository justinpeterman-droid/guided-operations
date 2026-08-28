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
    "/admin/paperwork/daily",
    "/admin/retention",
  ]) {
    await page.goto(path);
    await expect(
      page.getByRole("heading", { name: "Administrator access is required." }),
    ).toBeVisible();
  }

  await signOut(page);
});

test("the last administrator cannot demote their own account", async ({
  page,
}) => {
  await signIn(page, accounts.administrator);
  await page.goto("/admin/accounts");

  const administratorCard = page
    .getByRole("listitem")
    .filter({ hasText: "Fictional Qualification Administrator" });
  await administratorCard.getByRole("button", { name: "Make officer" }).click();
  await administratorCard
    .getByLabel("Your administrator passcode")
    .fill(accounts.administrator.passcode);
  await administratorCard
    .getByRole("button", { name: "Confirm: Make officer" })
    .click();
  await expect(
    administratorCard.getByText("This account role could not be changed."),
  ).toBeVisible();
  await expect(
    administratorCard.getByText(/Administrator · active · no shift/),
  ).toBeVisible();

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

  const invitedCard = page
    .getByRole("listitem")
    .filter({ hasText: "Fictional Invited Officer" });
  await invitedCard.getByRole("button", { name: "Change shift" }).click();
  await invitedCard.getByLabel("New assigned shift").selectOption("C");
  await invitedCard
    .getByLabel("Your administrator passcode")
    .fill(accounts.administrator.passcode);
  await invitedCard
    .getByRole("button", { name: "Confirm shift change" })
    .click();
  await expect(invitedCard.getByText("Shift changed")).toBeVisible();
  await page.reload();
  await expect(
    invitedCard.getByText(/Officer · active · shift C/),
  ).toBeVisible();

  await invitedCard.getByRole("button", { name: "Make administrator" }).click();
  await invitedCard
    .getByLabel("Your administrator passcode")
    .fill(accounts.administrator.passcode);
  await invitedCard
    .getByRole("button", { name: "Confirm: Make administrator" })
    .click();
  await expect(invitedCard.getByText("Role changed")).toBeVisible();
  await page.reload();
  await expect(
    invitedCard.getByText(/Administrator · active · shift C/),
  ).toBeVisible();

  await invitedCard.getByRole("button", { name: "Reset passcode" }).click();
  await invitedCard
    .getByLabel("Your administrator passcode")
    .fill(accounts.administrator.passcode);
  await invitedCard.getByRole("button", { name: "Confirm reset" }).click();
  await expect(
    invitedCard.getByRole("heading", {
      name: "Give this passcode to Fictional Invited Officer",
    }),
  ).toBeVisible();
  await expect(
    invitedCard.locator(".account-session-message strong"),
  ).toHaveText(/^[A-HJ-NP-Za-km-z2-9]{20}$/);
  await invitedCard
    .getByRole("button", { name: "I have handed it over" })
    .click();
  await page.reload();
  await expect(invitedCard.getByText(/passcode change required/)).toBeVisible();

  await invitedCard.getByRole("button", { name: "Disable account" }).click();
  await invitedCard
    .getByLabel("Your administrator passcode")
    .fill(accounts.administrator.passcode);
  await invitedCard.getByRole("button", { name: "Confirm disable" }).click();
  await expect(invitedCard.getByText("Disabled")).toBeVisible();
  await page.reload();
  await expect(
    invitedCard.getByText(/Administrator · disabled · shift C/),
  ).toBeVisible();
  await expect(
    invitedCard.getByRole("button", { name: "Disable account" }),
  ).toHaveCount(0);

  const lockedOfficerCard = page
    .getByRole("listitem")
    .filter({ hasText: "Fictional Locked Officer" });
  await expect(
    lockedOfficerCard.getByText(/Officer · locked · shift D/),
  ).toBeVisible();
  await lockedOfficerCard
    .getByRole("button", { name: "Unlock account" })
    .click();
  await lockedOfficerCard
    .getByLabel("Your administrator passcode")
    .fill(accounts.administrator.passcode);
  await lockedOfficerCard
    .getByRole("button", { name: "Confirm unlock" })
    .click();
  await expect(
    lockedOfficerCard.getByText(/Officer · active · shift D/),
  ).toBeVisible();

  await page.goto("/admin/audit");
  await expect(
    page.getByRole("heading", { name: "Activity log" }),
  ).toBeVisible();

  await page.goto("/admin/health");
  await expect(
    page.getByRole("heading", { name: "System health" }),
  ).toBeVisible();
  await expect(page.getByText("Supabase connection")).toBeVisible();

  await page.goto("/admin/paperwork/daily?workDate=2026-08-27&shiftCode=F");
  await expect(
    page.getByRole("heading", { name: "Daily Paperwork", level: 1 }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: /F · Five-day week field/ }),
  ).toBeVisible();
  await expect(page.locator(".daily-paperwork-grid article")).toHaveCount(6);
  await expect(page.getByText("Waiting for approved source")).toHaveCount(6);
  await expect(page.getByRole("button", { name: /print/i })).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByRole("heading", { name: "Shift Assignment Roster" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Handheld Metal Detector Sign-Out" }),
  ).toBeVisible();
  await page.setViewportSize({ width: 1280, height: 720 });

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
