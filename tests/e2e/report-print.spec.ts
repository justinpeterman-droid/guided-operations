import { expect, test } from "@playwright/test";

const reportId = "11111111-1111-4111-8111-111111111111";

test("keeps report viewing and print requests behind authentication", async ({
  page,
  request,
}) => {
  const response = await request.post(`/api/web/v1/reports/${reportId}/print`, {
    data: { revisionNumber: 1 },
    headers: { "idempotency-key": "fictional-print-key-1234" },
  });
  expect(response.status()).toBe(401);

  await page.goto(`/reports/${reportId}`);
  await expect(
    page.getByRole("heading", { name: "Sign in to view this report." }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Print current report" }),
  ).toHaveCount(0);
});
