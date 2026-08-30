import { expect, test, type Page } from "@playwright/test";
import axe from "axe-core";

const routes = [
  "/",
  "/login",
  "/account",
  "/forms",
  "/preview/workspace",
  "/preview/report-assistant",
  "/preview/policy-expert",
  "/preview/forms-library",
  "/preview/count-sheet",
  "/preview/admin",
  "/preview/admin-retention",
  "/preview/admin-paperwork-packages",
] as const;

type AccessibilityViolation = Readonly<{
  id: string;
  impact: string | null;
  nodes: ReadonlyArray<
    Readonly<{
      failureSummary: string | undefined;
      target: ReadonlyArray<string>;
    }>
  >;
}>;

async function accessibilityViolations(
  page: Page,
): Promise<ReadonlyArray<AccessibilityViolation>> {
  await page.addScriptTag({ content: axe.source });
  return page.evaluate(async () => {
    const results = await window.axe.run(document, {
      runOnly: {
        type: "tag",
        values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"],
      },
    });
    return results.violations.map((violation) => ({
      id: violation.id,
      impact: violation.impact ?? null,
      nodes: violation.nodes.map((node) => ({
        failureSummary: node.failureSummary,
        target: node.target.map(String),
      })),
    }));
  });
}

declare global {
  interface Window {
    axe: typeof axe;
  }
}

for (const route of routes) {
  test(`${route} has no automated WCAG A or AA violations`, async ({
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

    await page.goto(route);
    await page.waitForLoadState("networkidle");

    const violations = await accessibilityViolations(page);
    expect(
      violations,
      `Automated accessibility violations on ${route}:\n${JSON.stringify(violations, null, 2)}`,
    ).toEqual([]);
    expect(browserErrors).toEqual([]);
    expect(failedRequests).toEqual([]);
  });
}

test("preview navigation keeps a visible keyboard focus indicator", async ({
  page,
}) => {
  await page.goto("/preview/workspace");
  await page.keyboard.press("Tab");

  const focused = page.locator(":focus-visible");
  await expect(focused).toHaveCount(1);
  await expect(focused).toBeVisible();
  const focusStyle = await focused.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      outlineStyle: style.outlineStyle,
      outlineWidth: style.outlineWidth,
      boxShadow: style.boxShadow,
    };
  });
  expect(
    focusStyle.outlineStyle !== "none" ||
      focusStyle.outlineWidth !== "0px" ||
      focusStyle.boxShadow !== "none",
  ).toBe(true);
});

test("fictional preview routes remain usable at mobile size and reduced motion", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });

  for (const route of routes.filter((value) => value.startsWith("/preview/"))) {
    await page.goto(route);
    await expect
      .poll(() =>
        page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      )
      .toBe(true);
    await expect(page.locator("main")).toBeVisible();
  }
});
