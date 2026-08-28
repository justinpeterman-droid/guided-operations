import { expect, test, type Page } from "@playwright/test";

import {
  createLocalQualificationAccounts,
  type LocalQualificationCredentials,
} from "./support/local-qualification-account";

test.describe.configure({ mode: "serial" });

async function signIn(page: Page, credentials: LocalQualificationCredentials) {
  await page.goto("/login");
  await page.getByLabel("Employee number").fill(credentials.employeeNumber);
  await page.getByLabel("Passcode").fill(credentials.passcode);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/home");
}

test("sign out everywhere immediately denies every existing browser session", async ({
  browser,
}) => {
  test.setTimeout(45_000);
  const accounts = await createLocalQualificationAccounts();
  const firstContext = await browser.newContext();
  const secondContext = await browser.newContext();

  try {
    const firstPage = await firstContext.newPage();
    const secondPage = await secondContext.newPage();
    await signIn(firstPage, accounts.officer);
    await signIn(secondPage, accounts.officer);

    await firstPage.goto("/account");
    await firstPage
      .getByRole("button", { name: "Sign out everywhere" })
      .click();
    await firstPage
      .getByRole("button", { name: "Confirm sign out everywhere" })
      .click();
    await firstPage.waitForURL("**/login");

    await secondPage.goto("/home");
    await expect(
      secondPage.getByRole("heading", {
        name: "Sign in to open your workspace.",
      }),
    ).toBeVisible();

    // Session revocation must not disable the person's credential.
    await signIn(secondPage, accounts.officer);
    await expect(secondPage).toHaveURL(/\/home$/);
  } finally {
    await firstContext.close();
    await secondContext.close();
  }
});
