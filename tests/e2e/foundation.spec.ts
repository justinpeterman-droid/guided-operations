import { expect, test } from "@playwright/test";

import { collectFailedRequests } from "./support/failed-requests";

test("labels the workspace honestly and routes to sign in", async ({
  page,
}) => {
  const browserErrors: string[] = [];

  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });
  page.on("pageerror", (error) => browserErrors.push(error.message));
  const failedRequests = collectFailedRequests(page);

  await page.goto("/");

  await expect(
    page.getByRole("heading", {
      name: "Clear guidance for the work that has to be right.",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Go to sign in" }),
  ).toHaveAttribute("href", "/login");
  await expect(
    page.getByText("This is a working tool, not the system of record"),
  ).toBeVisible();
  expect(browserErrors).toEqual([]);
  expect(failedRequests).toEqual([]);
});

test("keeps account session controls behind the current-account gate", async ({
  page,
}) => {
  const browserErrors: string[] = [];

  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });
  page.on("pageerror", (error) => browserErrors.push(error.message));
  const failedRequests = collectFailedRequests(page);

  await page.goto("/account");

  await expect(
    page.getByRole("heading", {
      name: "Sign in to manage account safety.",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Go to sign in" }),
  ).toHaveAttribute("href", "/login");
  await expect(
    page.getByRole("button", { name: "Sign out everywhere" }),
  ).toHaveCount(0);
  expect(browserErrors).toEqual([]);
  expect(failedRequests).toEqual([]);
});
