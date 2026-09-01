import { expect, test, type Page } from "@playwright/test";

import {
  createLocalQualificationAccounts,
  type LocalQualificationCredentials,
} from "./support/local-qualification-account";

test.describe.configure({ mode: "serial" });

async function signIn(page: Page, credentials: LocalQualificationCredentials) {
  await page.goto("/login");
  await page.getByLabel("Employee number").fill(credentials.employeeNumber);
  await page.getByLabel("Passcode", { exact: true }).fill(credentials.passcode);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/home");
}

test("global sign-out and passcode replacement deny every existing browser session", async ({
  browser,
}) => {
  test.setTimeout(75_000);
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

    // A personal passcode replacement must have the same multi-device
    // revocation guarantee.
    await signIn(firstPage, accounts.officer);
    await firstPage.goto("/account");
    const replacementPasscode = "FictionalRotatedOfficerPasscode8!";
    await firstPage
      .getByLabel("Confirm employee number")
      .fill(accounts.officer.employeeNumber);
    await firstPage
      .getByLabel("Current passcode", { exact: true })
      .fill(accounts.officer.passcode);
    await firstPage
      .getByLabel("New personal passcode", { exact: true })
      .fill(replacementPasscode);
    await firstPage
      .getByLabel("Confirm new passcode", { exact: true })
      .fill(replacementPasscode);
    await firstPage.getByRole("button", { name: "Change passcode" }).click();
    await firstPage.waitForURL("**/login");

    await secondPage.goto("/home");
    await expect(
      secondPage.getByRole("heading", {
        name: "Sign in to open your workspace.",
      }),
    ).toBeVisible();

    await signIn(secondPage, {
      employeeNumber: accounts.officer.employeeNumber,
      passcode: replacementPasscode,
    });
    await expect(secondPage).toHaveURL(/\/home$/);
  } finally {
    await firstContext.close();
    await secondContext.close();
  }
});
