import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/server/security/request-origin", () => ({
  isTrustedMutationRequest: vi.fn(),
}));
vi.mock("@/server/security/session-csrf", () => ({
  hasValidSessionCsrfRequest: vi.fn(),
}));

import { isTrustedMutationRequest } from "@/server/security/request-origin";
import { hasValidSessionCsrfRequest } from "@/server/security/session-csrf";

import { validateReportDraftEndpointRequest } from "./report-draft-endpoint";

const body = {
  request: {
    schemaVersion: 2,
    incidentId: "11111111-1111-4111-8111-111111111111",
    sourceIncidentRevisionId: "22222222-2222-4222-8222-222222222222",
    reportingStaffMemberId: "55555555-5555-4555-8555-555555555555",
    reportType: "cover_letter",
    confirmedFactIds: ["33333333-3333-4333-8333-333333333333"],
  },
  sourceRevisionNumber: 1,
};

describe("report draft endpoint validation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("requires trusted mutation, session CSRF, JSON, retry key, and a closed request body", async () => {
    vi.mocked(isTrustedMutationRequest).mockReturnValue(true);
    vi.mocked(hasValidSessionCsrfRequest).mockReturnValue(true);

    await expect(
      validateReportDraftEndpointRequest(
        new Request("https://app.example.test/api", {
          method: "POST",
          headers: {
            origin: "https://app.example.test",
            "content-type": "application/json",
            "idempotency-key": "fictional-report-retry-key-1234",
          },
          body: JSON.stringify(body),
        }),
        "https://app.example.test",
        "44444444-4444-4444-8444-444444444444",
        "k".repeat(32),
      ),
    ).resolves.toMatchObject({
      ok: true,
      sourceRevisionNumber: 1,
      idempotencyKey: "fictional-report-retry-key-1234",
    });
  });

  it("rejects an untrusted mutation before processing a draft request", async () => {
    vi.mocked(isTrustedMutationRequest).mockReturnValue(false);
    await expect(
      validateReportDraftEndpointRequest(
        new Request("https://app.example.test/api", { method: "POST" }),
        "https://app.example.test",
        "44444444-4444-4444-8444-444444444444",
        "k".repeat(32),
      ),
    ).resolves.toEqual({
      ok: false,
      status: 403,
      code: "request_not_allowed",
    });
    expect(hasValidSessionCsrfRequest).not.toHaveBeenCalled();
  });

  it("rejects an invented report type at the public request boundary", async () => {
    vi.mocked(isTrustedMutationRequest).mockReturnValue(true);
    vi.mocked(hasValidSessionCsrfRequest).mockReturnValue(true);

    await expect(
      validateReportDraftEndpointRequest(
        new Request("https://app.example.test/api", {
          method: "POST",
          headers: {
            origin: "https://app.example.test",
            "content-type": "application/json",
            "idempotency-key": "fictional-report-retry-key-1234",
          },
          body: JSON.stringify({
            ...body,
            request: { ...body.request, reportType: "invented_report" },
          }),
        }),
        "https://app.example.test",
        "44444444-4444-4444-8444-444444444444",
        "k".repeat(32),
      ),
    ).resolves.toEqual({
      ok: false,
      status: 400,
      code: "invalid_request",
    });
  });
});
