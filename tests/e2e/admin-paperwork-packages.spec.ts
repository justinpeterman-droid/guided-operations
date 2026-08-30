import { expect, test } from "@playwright/test";

test("shows an inert fictional package manager without console or asset failures", async ({
  page,
}) => {
  const consoleErrors: string[] = [];
  const failedAssets: string[] = [];
  const adminApiRequests: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("requestfailed", (request) => failedAssets.push(request.url()));
  page.on("request", (request) => {
    if (request.url().includes("/api/admin/")) {
      adminApiRequests.push(request.url());
    }
  });

  await page.goto("/preview/admin-paperwork-packages");

  await expect(
    page.getByRole("heading", { name: "Approved form packages", level: 1 }),
  ).toBeVisible();
  await expect(page.getByText("Fictional training preview")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Review package" }),
  ).toBeDisabled();
  await expect(page.getByLabel("Six approved JSON files")).toBeDisabled();
  await expect(page.getByText("FICTIONAL-REVISION-01")).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    )
    .toBe(true);
  await page
    .getByRole("link", { name: /return to administrator preview/i })
    .focus();
  await expect(
    page.getByRole("link", { name: /return to administrator preview/i }),
  ).toBeFocused();
  expect(consoleErrors).toEqual([]);
  expect(failedAssets).toEqual([]);
  expect(adminApiRequests).toEqual([]);
});
