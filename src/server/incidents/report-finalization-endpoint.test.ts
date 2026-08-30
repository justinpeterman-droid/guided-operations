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

import { validateReportFinalizationEndpointRequest } from "./report-finalization-endpoint";

describe("report finalization endpoint validation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("requires trusted origin, session CSRF, JSON, retry key, and explicit human review", async () => {
    vi.mocked(isTrustedMutationRequest).mockReturnValue(true);
    vi.mocked(hasValidSessionCsrfRequest).mockReturnValue(true);

    await expect(
      validateReportFinalizationEndpointRequest(
        new Request("https://app.example.test/api", {
          method: "POST",
          headers: {
            origin: "https://app.example.test",
            "content-type": "application/json",
            "idempotency-key": "fictional-finalize-retry-key-1234",
          },
          body: JSON.stringify({
            narrative: "Fictional human-reviewed final narrative.",
            reviewedByOfficer: true,
          }),
        }),
        "https://app.example.test",
        "11111111-1111-4111-8111-111111111111",
        "k".repeat(32),
      ),
    ).resolves.toMatchObject({
      ok: true,
      narrative: "Fictional human-reviewed final narrative.",
      reviewedByOfficer: true,
      idempotencyKey: "fictional-finalize-retry-key-1234",
    });
  });

  it("rejects an untrusted mutation before parsing a finalization request", async () => {
    vi.mocked(isTrustedMutationRequest).mockReturnValue(false);

    await expect(
      validateReportFinalizationEndpointRequest(
        new Request("https://app.example.test/api", { method: "POST" }),
        "https://app.example.test",
        "11111111-1111-4111-8111-111111111111",
        "k".repeat(32),
      ),
    ).resolves.toEqual({
      ok: false,
      status: 403,
      code: "request_not_allowed",
    });
    expect(hasValidSessionCsrfRequest).not.toHaveBeenCalled();
  });

  it("refuses finalization without the explicit human-review attestation", async () => {
    vi.mocked(isTrustedMutationRequest).mockReturnValue(true);
    vi.mocked(hasValidSessionCsrfRequest).mockReturnValue(true);

    await expect(
      validateReportFinalizationEndpointRequest(
        new Request("https://app.example.test/api", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "idempotency-key": "fictional-finalize-retry-key-1234",
          },
          body: JSON.stringify({
            narrative: "Fictional human-reviewed final narrative.",
            reviewedByOfficer: false,
          }),
        }),
        "https://app.example.test",
        "11111111-1111-4111-8111-111111111111",
        "k".repeat(32),
      ),
    ).resolves.toEqual({
      ok: false,
      status: 400,
      code: "invalid_request",
    });
  });
});
