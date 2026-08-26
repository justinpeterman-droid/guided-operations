import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/server/security/request-origin", () => ({
  isTrustedMutationRequest: vi.fn(() => true),
}));
vi.mock("@/server/security/session-csrf", () => ({
  hasValidSessionCsrfRequest: vi.fn(() => true),
}));

import { isTrustedMutationRequest } from "@/server/security/request-origin";

import { validateCountSheetRestoreRequest } from "./restore-count-sheet-revision-endpoint";

const origin = "https://guided-operations.example.test";
const sessionId = "33333333-3333-4333-8333-333333333333";
const key = "k".repeat(32);

describe("Count Sheet restore request", () => {
  it("requires same-origin CSRF and a closed restore command", async () => {
    const request = new Request(
      `${origin}/api/web/v1/count-sheets/id/restore`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin,
          "idempotency-key": "fictional-restore-key-1234",
        },
        body: JSON.stringify({
          baseRevisionNumber: 2,
          restoreRevisionNumber: 1,
          reason: "Return to a reviewed fictional version.",
        }),
      },
    );

    await expect(
      validateCountSheetRestoreRequest(request, origin, sessionId, key),
    ).resolves.toMatchObject({
      ok: true,
      baseRevisionNumber: 2,
      restoreRevisionNumber: 1,
    });
  });

  it("rejects a cross-origin request before reading the body", async () => {
    vi.mocked(isTrustedMutationRequest).mockReturnValueOnce(false);
    const request = new Request(
      `${origin}/api/web/v1/count-sheets/id/restore`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "https://wrong.example.test",
        },
        body: "{}",
      },
    );
    await expect(
      validateCountSheetRestoreRequest(request, origin, sessionId, key),
    ).resolves.toEqual({
      ok: false,
      status: 403,
      code: "request_not_allowed",
    });
  });
});
