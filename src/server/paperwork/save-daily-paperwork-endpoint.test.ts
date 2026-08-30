import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/server/security/request-origin", () => ({
  isTrustedMutationRequest: vi.fn(() => true),
}));
vi.mock("@/server/security/session-csrf", () => ({
  hasValidSessionCsrfRequest: vi.fn(() => true),
}));

import { validateDailyPaperworkSaveRequest } from "./save-daily-paperwork-endpoint";

describe("Daily Paperwork save request", () => {
  it("accepts a bounded closed fictional command", async () => {
    await expect(
      validateDailyPaperworkSaveRequest(
        request({
          kind: "assignment_roster",
          workDate: "2026-08-27",
          shiftCode: "A",
          baseRevisionNumber: 0,
          payload: {
            schema_version: 1,
            fields: { supervisor: "Fictional" },
            tables: {},
          },
          reason: "Fictional save.",
        }),
        "https://guided-operations.example.invalid",
        "session",
        "k".repeat(32),
      ),
    ).resolves.toMatchObject({
      ok: true,
      kind: "assignment_roster",
      baseRevisionNumber: 0,
    });
  });

  it("rejects an undeclared command field", async () => {
    await expect(
      validateDailyPaperworkSaveRequest(
        request({
          kind: "assignment_roster",
          workDate: "2026-08-27",
          shiftCode: "A",
          baseRevisionNumber: 0,
          payload: {},
          reason: "Fictional save.",
          facilityId: "not accepted from the browser",
        }),
        "https://guided-operations.example.invalid",
        "session",
        "k".repeat(32),
      ),
    ).resolves.toEqual({
      ok: false,
      status: 400,
      code: "invalid_request",
    });
  });
});

function request(body: unknown): Request {
  return new Request("https://guided-operations.example.invalid", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "idempotency-key": "fictional-daily-retry-key-1234",
    },
    body: JSON.stringify(body),
  });
}
