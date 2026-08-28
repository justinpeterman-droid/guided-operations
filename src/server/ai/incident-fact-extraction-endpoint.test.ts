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

import { validateIncidentFactExtractionEndpointRequest } from "./incident-fact-extraction-endpoint";

describe("incident fact extraction endpoint validation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("requires trusted origin, session CSRF, JSON, and bounded notes", async () => {
    vi.mocked(isTrustedMutationRequest).mockReturnValue(true);
    vi.mocked(hasValidSessionCsrfRequest).mockReturnValue(true);
    await expect(
      validateIncidentFactExtractionEndpointRequest(
        new Request("https://app.example.test/api", {
          method: "POST",
          headers: {
            origin: "https://app.example.test",
            "content-type": "application/json",
          },
          body: JSON.stringify({ notes: "Fictional officer note." }),
        }),
        "https://app.example.test",
        "11111111-1111-4111-8111-111111111111",
        "k".repeat(32),
      ),
    ).resolves.toEqual({ ok: true, notes: "Fictional officer note." });
  });

  it("rejects extra browser fields", async () => {
    vi.mocked(isTrustedMutationRequest).mockReturnValue(true);
    vi.mocked(hasValidSessionCsrfRequest).mockReturnValue(true);
    await expect(
      validateIncidentFactExtractionEndpointRequest(
        new Request("https://app.example.test/api", {
          method: "POST",
          headers: {
            origin: "https://app.example.test",
            "content-type": "application/json",
          },
          body: JSON.stringify({
            notes: "Fictional officer note.",
            categoryKey: "browser-controlled-category",
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
