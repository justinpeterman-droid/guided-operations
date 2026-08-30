import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/server/security/request-origin", () => ({
  isTrustedMutationRequest: vi.fn(() => true),
}));
vi.mock("@/server/security/session-csrf", () => ({
  hasValidSessionCsrfRequest: vi.fn(() => true),
}));

import { validateCountSheetSaveRequest } from "./save-count-sheet-endpoint";

describe("Count Sheet save request", () => {
  it("accepts a bounded fictional save request with an idempotency key", async () => {
    await expect(
      validateCountSheetSaveRequest(
        new Request("https://guided-operations.example.invalid", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "idempotency-key": "fictional-count-sheet-retry-key-1234",
          },
          body: JSON.stringify({
            workDate: "2026-08-26",
            baseRevisionNumber: 0,
            structure: {},
            payload: {},
            reason: "Fictional initial count.",
          }),
        }),
        "https://guided-operations.example.invalid",
        "session",
        "k".repeat(32),
      ),
    ).resolves.toMatchObject({ ok: true, baseRevisionNumber: 0 });
  });
});
