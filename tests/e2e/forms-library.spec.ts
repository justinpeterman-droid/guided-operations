import { expect, test } from "@playwright/test";

test("keeps the real Forms Library behind a verified account", async ({
  page,
}) => {
  const consoleErrors: string[] = [];
  const failedAssets: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("requestfailed", (request) => failedAssets.push(request.url()));

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
  await page.goto("/preview/forms-library");

  await expect(
    page.getByRole("heading", {
      name: "Use the right form, with the right limits.",
    }),
  ).toBeVisible();
  await expect(page.getByText("Fictional training preview")).toBeVisible();
  await expect(
    page.getByRole("link", { name: /Open Count Sheet/ }),
  ).toHaveAttribute("href", "/preview/count-sheet");
  await expect(page.getByText("Not ready yet")).toHaveCount(2);
});
