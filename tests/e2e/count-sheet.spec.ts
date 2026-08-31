import { expect, test } from "@playwright/test";

import { collectFailedRequests } from "./support/failed-requests";

test("rejects a guessed operational print request without a current account", async ({
  request,
}) => {
  const response = await request.post(
    "/api/web/v1/count-sheets/11111111-1111-4111-8111-111111111111/print",
    {
      data: { revisionNumber: 1 },
      headers: {
        "idempotency-key": "fictional-browser-print-key-1234",
        origin: "http://127.0.0.1:3109",
        "x-csrf-token": "fictional-browser-csrf",
      },
    },
  );

  expect(response.status()).toBe(401);
  await expect(response.json()).resolves.toMatchObject({
    error: { code: "authentication_required" },
  });
});

test("keeps the operational Count Sheet behind current account and shift checks", async ({
  page,
}) => {
  const browserErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });
  page.on("pageerror", (error) => browserErrors.push(error.message));
  const failedRequests = collectFailedRequests(page);

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
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });
  page.on("pageerror", (error) => browserErrors.push(error.message));
  const failedRequests = collectFailedRequests(page);

  await page.goto("/preview/count-sheet");

  await expect(
    page.getByRole("heading", { name: "North Central Unit Count Sheet" }),
  ).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Iso" })).toBeVisible();
  await expect(
    page.getByRole("rowheader", { name: "Chow Hall" }),
  ).toBeVisible();
  await expect(
    page.getByText("Incomplete — enter known values to reconcile."),
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
    page.getByText("Incomplete — enter known values to reconcile."),
  ).toBeVisible();
  expect(browserErrors).toEqual([]);
  expect(failedRequests).toEqual([]);
});

test("keeps the approved training sheet usable on a reduced-motion mobile view and marks print output", async ({
  page,
}) => {
  const browserErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });
  page.on("pageerror", (error) => browserErrors.push(error.message));
  const failedRequests = collectFailedRequests(page);
  await page.setViewportSize({ height: 844, width: 390 });
  await page.emulateMedia({ reducedMotion: "reduce" });

  await page.goto("/preview/count-sheet");

  const firstCell = page.getByRole("textbox", {
    name: "A/W Office, 1",
    exact: true,
  });
  await page.getByRole("button", { name: "Print training preview" }).focus();
  await page.keyboard.press("Tab");
  await expect(firstCell).toBeFocused();
  await firstCell.fill("1");
  await expect(firstCell).toHaveValue("1");
  await page.emulateMedia({ media: "print", reducedMotion: "reduce" });
  await expect(
    page.getByText(
      "Fictional training preview — not an approved operational form",
    ),
  ).toBeVisible();
  const printFit = await page.evaluate(() => {
    const wrapper = document.querySelector<HTMLElement>(
      ".count-sheet-table-wrap",
    );
    return {
      pageWidth: document.documentElement.scrollWidth,
      viewportWidth: document.documentElement.clientWidth,
      wrapperOverflowX: wrapper
        ? getComputedStyle(wrapper).overflowX
        : "missing",
    };
  });
  expect(printFit.wrapperOverflowX).toBe("visible");
  expect(printFit.pageWidth).toBeLessThanOrEqual(printFit.viewportWidth);
  expect(browserErrors).toEqual([]);
  expect(failedRequests).toEqual([]);
});
