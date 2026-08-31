import type { Page } from "@playwright/test";

/**
 * Collects requests the browser genuinely failed to load.
 *
 * A cancelled request is not a failure. Next.js speculatively prefetches the
 * links it renders, and aborts a prefetch when the route redirects or the page
 * navigates away before the response arrives. Counting those as failures makes
 * a passing page look broken.
 */
export function collectFailedRequests(page: Page): string[] {
  const failed: string[] = [];

  page.on("requestfailed", (request) => {
    const failure = request.failure()?.errorText ?? "unknown network failure";
    if (failure.includes("ERR_ABORTED")) return;
    failed.push(`${request.url()}: ${failure}`);
  });

  return failed;
}
