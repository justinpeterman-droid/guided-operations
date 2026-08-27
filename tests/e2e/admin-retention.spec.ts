import { expect, test } from "@playwright/test";

test("shows the fictional legal-hold layout safely at desktop and mobile sizes", async ({
  page,
}) => {
  const consoleErrors: string[] = [];
  const failedAssets: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("requestfailed", (request) => failedAssets.push(request.url()));

  await page.goto("/preview/admin-retention");

  await expect(
    page.getByRole("heading", { name: "Retention and legal holds" }),
  ).toBeVisible();
  await expect(page.getByText("Fictional training preview")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Confirm legal hold" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Release hold" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /delete/i })).toHaveCount(0);

  await page.getByLabel("Record type").focus();
  await expect(page.getByLabel("Record type")).toBeFocused();

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByRole("heading", { name: "Retention and legal holds" }),
  ).toBeVisible();
  const hasHorizontalOverflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth,
  );
  expect(hasHorizontalOverflow).toBe(false);
  expect(consoleErrors).toEqual([]);
  expect(failedAssets).toEqual([]);
});
