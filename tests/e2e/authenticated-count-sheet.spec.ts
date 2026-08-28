import { expect, test } from "@playwright/test";

import {
  createLocalQualificationOfficer,
  type LocalQualificationCredentials,
} from "./support/local-qualification-account";

test.describe.configure({ mode: "serial" });

let officer: LocalQualificationCredentials;

test.beforeAll(async () => {
  officer = await createLocalQualificationOfficer();
});

test("public signup stays disabled while private password sign-in remains available", async ({
  request,
}) => {
  const response = await request.post(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/signup`,
    {
      data: {
        email: "blocked-public-signup@fictional.invalid",
        password: "FictionalBlockedSignupPasscode9!",
      },
      headers: {
        apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "",
      },
    },
  );

  expect(response.ok()).toBe(false);
  expect([400, 422]).toContain(response.status());
});

test("a fictional officer signs in, saves, reopens, prints, and signs out", async ({
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
  await page.addInitScript(() => {
    window.print = () => {
      document.documentElement.dataset.printInvoked = "true";
    };
  });

  await page.goto("/login");
  await page.getByLabel("Employee number").fill(officer.employeeNumber);
  await page.getByLabel("Passcode").fill(officer.passcode);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/home");

  const authCookies = (await page.context().cookies())
    .filter((cookie) => cookie.name.startsWith("go-auth-session"))
    .sort((left, right) => left.name.localeCompare(right.name));
  expect(authCookies.length).toBeGreaterThan(0);
  expect(authCookies.every((cookie) => cookie.httpOnly)).toBe(true);
  expect(authCookies.every((cookie) => cookie.sameSite === "Lax")).toBe(true);
  expect(authCookies.every((cookie) => !cookie.secure)).toBe(true);
  const encryptedSession = authCookies.map((cookie) => cookie.value).join("");
  expect(encryptedSession).toMatch(
    /^v1\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{22}$/,
  );
  expect(encryptedSession).not.toContain("access_token");
  expect(encryptedSession).not.toContain("refresh_token");
  expect(encryptedSession).not.toContain("@");
  expect(await page.evaluate(() => document.cookie)).not.toContain(
    "go-auth-session",
  );

  await page.goto("/count-sheet");
  await expect(
    page.getByRole("heading", { name: "North Central Unit Count Sheet" }),
  ).toBeVisible();
  await expect(
    page.getByText(/Protected shift record · Shift A/),
  ).toBeVisible();
  await expect(
    page.getByText(/No saved sheet exists for this date/),
  ).toBeVisible();

  await page.getByLabel("Count started").fill("08:00");
  await page.getByLabel("Count ended").fill("08:15");
  await page.getByLabel("Chow Hall, 1", { exact: true }).fill("2");
  await page.getByLabel("In housing, 1", { exact: true }).fill("8");
  await page.getByLabel("Operational total, on site").fill("10");
  await expect(
    page.getByText("Reconciled — review before saving."),
  ).toBeVisible();

  await page.getByRole("button", { name: "Save new revision" }).click();
  await expect(page.getByText(/Saved as revision 1/)).toBeVisible();

  await page.reload();
  await expect(page.getByText(/Saved revision 1 loaded/)).toBeVisible();
  await expect(page.getByLabel("Chow Hall, 1", { exact: true })).toHaveValue(
    "2",
  );
  await expect(page.getByLabel("In housing, 1", { exact: true })).toHaveValue(
    "8",
  );
  await expect(
    page.getByRole("listitem").filter({ hasText: "Revision 1 (current)" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Print saved sheet" }).click();
  await expect(
    page.getByText(/Print request recorded.*Opening the browser print dialog/),
  ).toBeVisible();
  await expect
    .poll(() => page.locator("html").getAttribute("data-print-invoked"))
    .toBe("true");

  await page.goto("/account");
  await page.getByRole("button", { name: "Sign out of this browser" }).click();
  await page.waitForURL("**/login");
  expect(
    (await page.context().cookies()).filter((cookie) =>
      cookie.name.startsWith("go-auth-session"),
    ),
  ).toEqual([]);
  await page.goto("/count-sheet");
  await expect(
    page.getByRole("heading", { name: "Sign in to use the Count Sheet." }),
  ).toBeVisible();

  expect(browserErrors).toEqual([]);
  expect(failedRequests).toEqual([]);
});
