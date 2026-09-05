import { expect, test } from "@playwright/test";

test("top navigation follows pages and the mobile menu supports keyboard dismissal", async ({
  page,
}) => {
  await page.goto("/preview/workspace");
  const navigation = page.getByRole("navigation", { name: "Workspace" });
  await expect(
    navigation.getByRole("link", { name: "Home", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await navigation
    .getByRole("link", { name: "Policy Expert", exact: true })
    .click();
  await expect(page).toHaveURL(/\/preview\/policy-expert$/);
  await expect(
    navigation.getByRole("link", { name: "Policy Expert", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(navigation).toBeHidden();
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  await expect(navigation).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(navigation).toBeHidden();
  await expect(
    page.getByRole("button", { name: "Menu", exact: true }),
  ).toBeFocused();
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  await navigation
    .getByRole("link", { name: "Report Assistant", exact: true })
    .click();
  await expect(page).toHaveURL(/\/preview\/report-assistant$/);
  await expect(
    page.getByRole("button", { name: "Menu", exact: true }),
  ).toHaveAttribute("aria-expanded", "false");
});

test("keeps report and policy as equal working preview paths", async ({
  page,
}) => {
  const browserErrors: string[] = [];
  const failedRequests: string[] = [];
  const forbiddenResponses: string[] = [];

  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });
  page.on("pageerror", (error) => browserErrors.push(error.message));
  page.on("requestfailed", (request) => failedRequests.push(request.url()));
  page.on("response", (response) => {
    if (response.status() === 403) forbiddenResponses.push(response.url());
  });

  await page.goto("/preview/workspace");

  await expect(
    page.getByRole("heading", {
      name: "You did the work. Keep the paperwork clear.",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: /Start a report/ }),
  ).toHaveAttribute("href", "/preview/report-assistant");
  await expect(
    page.getByRole("link", { name: /Ask Policy Expert/ }),
  ).toHaveAttribute("href", "/preview/policy-expert");
  await expect(page.getByText("Fictional training examples")).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByRole("link", { name: /Ask Policy Expert/ }),
  ).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    )
    .toBe(true);

  await page.getByRole("link", { name: /Ask Policy Expert/ }).click();
  await expect(page).toHaveURL(/\/preview\/policy-expert$/);
  await expect(
    page.getByRole("heading", { name: "Find the source before you decide." }),
  ).toBeVisible();
  await page.waitForLoadState("networkidle");
  await page
    .getByRole("button", {
      name: "What happens when the source is missing?",
    })
    .click();
  expect(forbiddenResponses).toEqual([]);
  expect(browserErrors).toEqual([]);
  expect(failedRequests).toEqual([]);
  await expect(
    page.getByText(
      /must return approved source passages or say that evidence is unavailable/i,
    ),
  ).toBeVisible();
});
