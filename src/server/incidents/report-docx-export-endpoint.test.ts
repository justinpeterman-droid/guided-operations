import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/server/security/request-origin", () => ({
  isTrustedMutationRequest: vi.fn(() => true),
}));
vi.mock("@/server/security/session-csrf", () => ({
  hasValidSessionCsrfRequest: vi.fn(() => true),
}));

import { isTrustedMutationRequest } from "@/server/security/request-origin";

import { validateReportDocxExportRequest } from "./report-docx-export-endpoint";

const origin = "https://guided-operations.example.test";
const headers = { "idempotency-key": "fictional-export-key-1234" };

describe("report DOCX export request", () => {
  it("accepts one canonical explicit revision and an empty body", async () => {
    await expect(
      validateReportDocxExportRequest(
        new Request(`${origin}/export-docx?revision=3`, {
          method: "POST",
          headers,
        }),
        origin,
        "session",
        "k".repeat(32),
      ),
    ).resolves.toMatchObject({ ok: true, revisionNumber: 3 });
  });

  it.each([
    "",
    "?revision=03",
    "?revision=0",
    "?revision=3&revision=4",
    "?revision=3&extra=1",
  ])("rejects ambiguous or non-canonical query %s", async (query) => {
    await expect(
      validateReportDocxExportRequest(
        new Request(`${origin}/export-docx${query}`, {
          method: "POST",
          headers,
        }),
        origin,
        "session",
        "k".repeat(32),
      ),
    ).resolves.toMatchObject({ ok: false, status: 400 });
  });

  it("rejects a body and a cross-origin request", async () => {
    const bodyResult = await validateReportDocxExportRequest(
      new Request(`${origin}/export-docx?revision=3`, {
        method: "POST",
        headers,
        body: "unexpected",
      }),
      origin,
      "session",
      "k".repeat(32),
    );
    expect(bodyResult).toMatchObject({ ok: false, status: 400 });

    vi.mocked(isTrustedMutationRequest).mockReturnValueOnce(false);
    await expect(
      validateReportDocxExportRequest(
        new Request(`${origin}/export-docx?revision=3`, {
          method: "POST",
          headers,
        }),
        origin,
        "session",
        "k".repeat(32),
      ),
    ).resolves.toMatchObject({ ok: false, status: 403 });
  });
});
