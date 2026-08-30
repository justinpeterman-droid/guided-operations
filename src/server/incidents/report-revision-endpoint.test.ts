import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/server/security/request-origin", () => ({
  isTrustedMutationRequest: vi.fn(() => true),
}));
vi.mock("@/server/security/session-csrf", () => ({
  hasValidSessionCsrfRequest: vi.fn(() => true),
}));
import { validateReportRevisionRequest } from "./report-revision-endpoint";
describe("report revision request", () => {
  it("accepts only a bounded correction with retry key", async () => {
    await expect(
      validateReportRevisionRequest(
        new Request("https://x", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "idempotency-key": "fictional-revision-retry-key-1234",
          },
          body: JSON.stringify({
            baseRevisionNumber: 1,
            narrative: "Fictional correction.",
            reason: "Fictional reason.",
          }),
        }),
        "https://x",
        "s",
        "k".repeat(32),
      ),
    ).resolves.toMatchObject({ ok: true, baseRevisionNumber: 1 });
  });
});
