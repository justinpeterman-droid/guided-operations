import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env/auth-server", () => ({ getAuthServerEnvironment: vi.fn() }));
vi.mock("@/lib/env/incident-server", () => ({
  getIncidentServerEnvironment: vi.fn(),
}));
vi.mock("@/lib/env/runtime", () => ({ getRuntimeEnvironment: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(),
}));
vi.mock("@/server/auth/current-session", () => ({
  authorizeCurrentSession: vi.fn(),
}));
vi.mock("@/server/exports/report-revision-docx", () => ({
  createReportRevisionDocx: vi.fn(() => Buffer.from("fictional-docx")),
  REPORT_DOCX_MEDIA_TYPE:
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  REPORT_DOCX_TEMPLATE_VERSION: "guided-operations-reviewed-report-v1",
}));
vi.mock("@/server/incidents/get-report-revision-for-export", () => ({
  getReportRevisionForExport: vi.fn(),
}));
vi.mock("@/server/incidents/record-report-docx-export", () => ({
  recordReportDocxExport: vi.fn(),
}));
vi.mock("@/server/incidents/report-docx-export-endpoint", () => ({
  validateReportDocxExportRequest: vi.fn(),
}));

import { getAuthServerEnvironment } from "@/lib/env/auth-server";
import { getIncidentServerEnvironment } from "@/lib/env/incident-server";
import { getRuntimeEnvironment } from "@/lib/env/runtime";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { authorizeCurrentSession } from "@/server/auth/current-session";
import { getReportRevisionForExport } from "@/server/incidents/get-report-revision-for-export";
import { recordReportDocxExport } from "@/server/incidents/record-report-docx-export";
import { validateReportDocxExportRequest } from "@/server/incidents/report-docx-export-endpoint";

import { POST } from "./route";

const client = {};
const reportId = "11111111-1111-4111-8111-111111111111";
const revision = {
  reportId,
  reportRevisionId: "22222222-2222-4222-8222-222222222222",
  revisionNumber: 2,
  incidentNumber: "FICTIONAL-001",
  incidentName: "Fictional report",
  reportType: "first_person" as const,
  narrative: "Fictional narrative.",
  schemaVersion: 2,
  sourceIncidentRevisionId: "33333333-3333-4333-8333-333333333333",
  createdAt: "2026-08-27T14:30:00Z",
};

describe("POST report DOCX export", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getAuthServerEnvironment).mockReturnValue({
      CSRF_HMAC_KEY: "c".repeat(32),
    } as never);
    vi.mocked(getIncidentServerEnvironment).mockReturnValue({
      INCIDENT_IDEMPOTENCY_HMAC_KEY: "i".repeat(32),
    });
    vi.mocked(getRuntimeEnvironment).mockReturnValue({
      APP_ORIGIN: "https://example.test",
    } as never);
    vi.mocked(createSupabaseServerClient).mockResolvedValue(client as never);
    vi.mocked(authorizeCurrentSession).mockResolvedValue({
      allowed: true,
      sessionId: "44444444-4444-4444-8444-444444444444",
    } as never);
    vi.mocked(validateReportDocxExportRequest).mockResolvedValue({
      ok: true,
      revisionNumber: 2,
      idempotencyKey: "fictional-export-key-1234",
    });
    vi.mocked(getReportRevisionForExport).mockResolvedValue({
      kind: "found",
      revision,
    });
    vi.mocked(recordReportDocxExport).mockResolvedValue({
      kind: "recorded",
      exportId: "55555555-5555-4555-8555-555555555555",
    });
  });

  it("returns bytes only after exact-revision authorization and audit both succeed", async () => {
    const response = await POST(
      new Request("https://example.test/export-docx?revision=2", {
        method: "POST",
      }),
      { params: Promise.resolve({ reportId }) },
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(response.headers.get("Content-Disposition")).toContain(
      `report-${reportId}-revision-2.docx`,
    );
    expect(response.headers.get("X-Export-ID")).toBe(
      "55555555-5555-4555-8555-555555555555",
    );
    expect(await response.text()).toBe("fictional-docx");
    expect(recordReportDocxExport).toHaveBeenCalledWith(
      expect.objectContaining({
        reportId,
        revisionNumber: 2,
        outputSha256: expect.stringMatching(/^[a-f0-9]{64}$/),
        sizeBytes: 14,
      }),
      client,
      "i".repeat(32),
    );
  });

  it("returns no document when the access recheck fails", async () => {
    vi.mocked(recordReportDocxExport).mockResolvedValue({ kind: "denied" });
    const response = await POST(
      new Request("https://example.test/export-docx?revision=2", {
        method: "POST",
      }),
      { params: Promise.resolve({ reportId }) },
    );
    expect(response.status).toBe(403);
    expect(response.headers.get("Content-Type")).toContain("application/json");
  });

  it("does not disclose an absent or unauthorized revision", async () => {
    vi.mocked(getReportRevisionForExport).mockResolvedValue({
      kind: "not_found",
    });
    const response = await POST(
      new Request("https://example.test/export-docx?revision=9", {
        method: "POST",
      }),
      { params: Promise.resolve({ reportId }) },
    );
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "report_revision_unavailable" },
    });
  });
});
