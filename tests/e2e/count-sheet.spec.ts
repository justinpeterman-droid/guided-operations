import { expect, test } from "@playwright/test";

test("keeps the operational Count Sheet behind current account and shift checks", async ({
  page,
}) => {
  const browserErrors: string[] = [];
  const failedRequests: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });
  page.on("pageerror", (error) => browserErrors.push(error.message));
  page.on("requestfailed", (request) => failedRequests.push(request.url()));

  await page.goto("/count-sheet");

  await expect(
    page.getByRole("heading", { name: "Sign in to use the Count Sheet." }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Sign in" })).toHaveAttribute(
    "href",
    "/login",
  );
  expect(browserErrors).toEqual([]);
  expect(failedRequests).toEqual([]);
});

test("renders and calculates the approved Count Sheet with fictional browser-only values", async ({
  page,
}) => {
  const browserErrors: string[] = [];
  const failedRequests: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });
  page.on("pageerror", (error) => browserErrors.push(error.message));
  page.on("requestfailed", (request) => failedRequests.push(request.url()));

  await page.goto("/preview/count-sheet");

  await expect(
    page.getByRole("heading", { name: "North Central Unit Count Sheet" }),
  ).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Iso" })).toBeVisible();
  await expect(
    page.getByRole("rowheader", { name: "Chow Hall" }),
  ).toBeVisible();
  await page
    .getByRole("textbox", { name: "Chow Hall, 1", exact: true })
    .fill("2");
  await page
    .getByRole("textbox", { name: "In housing, 1", exact: true })
    .fill("8");
  await page
    .getByRole("textbox", { name: "Operational total, on site" })
    .fill("10");
  await expect(
    page.getByText("Reconciled — review before any future save."),
  ).toBeVisible();
  expect(browserErrors).toEqual([]);
  expect(failedRequests).toEqual([]);
});

test("keeps the approved training sheet usable on a reduced-motion mobile view and marks print output", async ({
  page,
}) => {
  const browserErrors: string[] = [];
  const failedRequests: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });
  page.on("pageerror", (error) => browserErrors.push(error.message));
  page.on("requestfailed", (request) => failedRequests.push(request.url()));
  await page.setViewportSize({ height: 844, width: 390 });
  await page.emulateMedia({ reducedMotion: "reduce" });

  await page.goto("/preview/count-sheet");

  const firstCell = page.getByRole("textbox", {
    name: "A/W Office, 1",
    exact: true,
  });
  await firstCell.focus();
  await firstCell.fill("1");
  await expect(firstCell).toHaveValue("1");
  await page.emulateMedia({ media: "print", reducedMotion: "reduce" });
  await expect(
    page.getByText(
      "Fictional training preview — not an approved operational form",
    ),
  ).toBeVisible();
  expect(browserErrors).toEqual([]);
  expect(failedRequests).toEqual([]);
});
