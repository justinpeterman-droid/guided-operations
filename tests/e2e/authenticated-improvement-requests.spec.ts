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
  await page.getByLabel("Passcode", { exact: true }).fill(credentials.passcode);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/home");
}

async function signOut(page: Page) {
  await page.goto("/account");
  await page.getByRole("button", { name: "Sign out of this browser" }).click();
  await page.waitForURL("**/login");
}

test("an officer submits a blank form candidate and an administrator reviews it", async ({
  page,
}) => {
  test.setTimeout(60_000);
  const title = "Fictional browser-qualified form candidate";
  const reviewMessage = "Fictional administrator review started.";

  await signIn(page, accounts.officer);
  await page.goto("/home");
  await page.getByRole("button", { name: "Suggest a change" }).click();
  await page
    .getByRole("link", { name: "Request or upload a form" })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Request a form, or send a blank candidate.",
    }),
  ).toBeVisible();
  await page.getByLabel("Form name").fill(title);
  await page
    .getByLabel("What should this form help staff do?")
    .fill("Fictional blank form used only to qualify the protected review path.");
  await page.getByLabel(/Attach a blank form candidate/).setInputFiles({
    name: "fictional-blank-form.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4\n%fictional-browser-qualification\n"),
  });

  await page.getByRole("button", { name: "Submit and upload for review" }).click();
  await page.waitForURL(/\/improvements\/[0-9a-f-]{36}\?submitted=1$/);
  const requestPath = new URL(page.url()).pathname;
  await expect(page.getByText("Private file received: fictional-blank-form.pdf")).toBeVisible();
  await expect(page.getByText(title)).toBeVisible();

  await signOut(page);
  await signIn(page, accounts.administrator);
  await page.goto("/admin/improvements");
  await expect(page.getByRole("link", { name: new RegExp(title) })).toBeVisible();
  await page.getByRole("link", { name: new RegExp(title) }).click();
  await expect(page).toHaveURL(requestPath);
  await expect(
    page.getByRole("heading", { name: "Administrator review" }),
  ).toBeVisible();
  await page.getByLabel("Update status").selectOption("under_review");
  await page.getByLabel("Message to submitter").fill(reviewMessage);
  await page.getByRole("button", { name: "Save review update" }).click();
  await expect(page.getByText(reviewMessage)).toBeVisible();

  await signOut(page);
  await signIn(page, accounts.officer);
  await page.goto(requestPath);
  await expect(page.getByText(reviewMessage)).toBeVisible();
  await expect(
    page.locator(".improvement-status", { hasText: "under review" }),
  ).toBeVisible();
});
