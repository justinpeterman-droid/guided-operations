import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/server/security/request-origin", () => ({
  isTrustedMutationRequest: vi.fn(() => true),
}));
vi.mock("@/server/security/session-csrf", () => ({
  hasValidSessionCsrfRequest: vi.fn(() => true),
}));

import { isTrustedMutationRequest } from "@/server/security/request-origin";

import { validateCountSheetPrintRequest } from "./record-count-sheet-print-endpoint";

const origin = "https://guided-operations.example.test";

describe("Count Sheet print audit request", () => {
  it("accepts only one saved revision number with a bounded retry key", async () => {
    const request = new Request(`${origin}/api/print`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "idempotency-key": "fictional-print-key-1234",
      },
      body: JSON.stringify({ revisionNumber: 3 }),
    });
    await expect(
      validateCountSheetPrintRequest(
        request,
        origin,
        "session",
        "k".repeat(32),
      ),
    ).resolves.toMatchObject({ ok: true, revisionNumber: 3 });
  });

  it("rejects a cross-origin output request", async () => {
    vi.mocked(isTrustedMutationRequest).mockReturnValueOnce(false);
    const request = new Request(`${origin}/api/print`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ revisionNumber: 3 }),
    });
    await expect(
      validateCountSheetPrintRequest(
        request,
        origin,
        "session",
        "k".repeat(32),
      ),
    ).resolves.toEqual({
      ok: false,
      status: 403,
      code: "request_not_allowed",
    });
  });
});
