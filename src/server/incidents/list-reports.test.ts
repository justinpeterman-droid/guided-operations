import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { listReportsForCurrentSession } from "./list-reports";

const account = {
  auth_user_id: "11111111-1111-4111-8111-111111111111",
  facility_id: "22222222-2222-4222-8222-222222222222",
  role: "officer",
  status: "active",
  auth_version: 1,
  must_change_passcode: false,
};
const row = {
  report_id: "33333333-3333-4333-8333-333333333333",
  incident_number: "F-REPORT-001",
  incident_name: "Fictional report scenario",
  report_type: "fictional-training-report",
  status: "draft",
  current_revision_number: 1,
  updated_at: "2026-08-26T12:00:00Z",
};

function client(options: { claims?: unknown; reports?: unknown } = {}) {
  return {
    auth: {
      getClaims: vi.fn().mockResolvedValue({
        data: {
          claims: options.claims ?? {
            sub: account.auth_user_id,
            session_id: "44444444-4444-4444-8444-444444444444",
            app_metadata: { auth_version: 1 },
          },
        },
        error: null,
      }),
    },
    rpc: vi.fn(async (name: string) =>
      name === "current_account"
        ? { data: [account], error: null }
        : { data: options.reports ?? [row], error: null },
    ),
  };
}

describe("listReportsForCurrentSession", () => {
  it("maps only authorized report summary fields", async () => {
    const sessionClient = client();
    await expect(listReportsForCurrentSession(sessionClient, 50)).resolves.toEqual({
      kind: "listed",
      reports: [
        {
          reportId: row.report_id,
          incidentNumber: row.incident_number,
          incidentName: row.incident_name,
          reportType: row.report_type,
          status: row.status,
          currentRevisionNumber: row.current_revision_number,
          updatedAt: row.updated_at,
        },
      ],
    });
    expect(sessionClient.rpc).toHaveBeenLastCalledWith("list_reports", {
      p_limit: 50,
    });
  });

  it("denies an untrusted session before the report-list RPC", async () => {
    const sessionClient = client({ claims: {} });
    await expect(listReportsForCurrentSession(sessionClient, 50)).resolves.toEqual({
      kind: "denied",
    });
    expect(sessionClient.rpc).not.toHaveBeenCalledWith(
      "list_reports",
      expect.anything(),
    );
  });

  it("fails closed on malformed report summary rows", async () => {
    await expect(
      listReportsForCurrentSession(client({ reports: [{ report_id: "bad" }] }), 50),
    ).resolves.toEqual({ kind: "unavailable" });
  });
});
