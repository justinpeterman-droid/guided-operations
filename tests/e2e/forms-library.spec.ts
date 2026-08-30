import { expect, test } from "@playwright/test";

import { collectFailedRequests } from "./support/failed-requests";

test("keeps the real Forms Library behind a verified account", async ({
  page,
}) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  const failedAssets = collectFailedRequests(page);

  await page.goto("/forms");

  await expect(
    page.getByRole("heading", { name: "Sign in to open the Forms Library." }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Sign in" })).toHaveAttribute(
    "href",
    "/login",
  );
  expect(consoleErrors).toEqual([]);
  expect(failedAssets).toEqual([]);
});

test("shows only honest fictional form availability in the public preview", async ({
  page,
}) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => consoleErrors.push(error.message));
  const failedAssets = collectFailedRequests(page);

  await page.goto("/preview/forms-library");

  await expect(
    page.getByRole("heading", {
      name: "Find the right paperwork.",
    }),
  ).toBeVisible();
  await expect(page.getByText("Fictional training preview")).toBeVisible();
  await expect(
    page.getByRole("link", { name: /Open Count Sheet/ }),
  ).toHaveAttribute("href", "/preview/count-sheet");
  await expect(
    page.getByRole("heading", { name: "Chain of Custody" }),
  ).toBeVisible();
  await expect(page.getByText("No digital substitute")).toBeVisible();
  await expect(
    page.getByRole("link", { name: /Chain of Custody/ }),
  ).toHaveCount(0);
  await expect(page.getByText("Not available")).toHaveCount(1);

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByRole("heading", { name: "Physical-only paperwork" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Monthly packets" }),
  ).toBeVisible();

  expect(consoleErrors).toEqual([]);
  expect(failedAssets).toEqual([]);
});
