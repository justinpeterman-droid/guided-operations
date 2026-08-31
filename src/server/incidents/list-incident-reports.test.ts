import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { listReportsForIncidentForCurrentSession } from "./list-incident-reports";

const accountRow = {
  auth_user_id: "11111111-1111-4111-8111-111111111111",
  facility_id: "22222222-2222-4222-8222-222222222222",
  role: "officer",
  status: "active",
  auth_version: 1,
  must_change_passcode: false,
};
const incidentId = "33333333-3333-4333-8333-333333333333";
const reportRow = {
  report_id: "55555555-5555-4555-8555-555555555555",
  incident_number: "F-SCOPED-001",
  incident_name: "Fictional scoped incident",
  report_type: "first_person",
  status: "complete",
  current_revision_number: 101,
  updated_at: "2026-08-30T12:00:00Z",
};

function client(options: { claims?: unknown; reports?: unknown } = {}) {
  return {
    auth: {
      getClaims: vi.fn().mockResolvedValue({
        data: {
          claims: options.claims ?? {
            sub: accountRow.auth_user_id,
            session_id: "44444444-4444-4444-8444-444444444444",
            app_metadata: { auth_version: 1 },
          },
        },
        error: null,
      }),
    },
    rpc: vi.fn(async (name: string) => {
      if (name === "current_account") {
        return { data: [accountRow], error: null };
      }
      return { data: options.reports ?? [reportRow], error: null };
    }),
  };
}

describe("listReportsForIncidentForCurrentSession", () => {
  it("loads every authorized report for the selected incident directly", async () => {
    const sessionClient = client();

    await expect(
      listReportsForIncidentForCurrentSession(incidentId, sessionClient),
    ).resolves.toEqual({
      kind: "listed",
      reports: [
        {
          reportId: reportRow.report_id,
          incidentNumber: reportRow.incident_number,
          incidentName: reportRow.incident_name,
          reportType: reportRow.report_type,
          status: reportRow.status,
          currentRevisionNumber: reportRow.current_revision_number,
          updatedAt: reportRow.updated_at,
        },
      ],
    });
    expect(sessionClient.rpc).toHaveBeenLastCalledWith(
      "list_incident_reports",
      { p_incident_id: incidentId },
    );
  });

  it("returns an empty complete list when an authorized incident has no reports", async () => {
    await expect(
      listReportsForIncidentForCurrentSession(
        incidentId,
        client({ reports: [] }),
      ),
    ).resolves.toEqual({ kind: "listed", reports: [] });
  });

  it("denies an untrusted session before the scoped RPC", async () => {
    const sessionClient = client({ claims: {} });

    await expect(
      listReportsForIncidentForCurrentSession(incidentId, sessionClient),
    ).resolves.toEqual({ kind: "denied" });
    expect(sessionClient.rpc).not.toHaveBeenCalledWith(
      "list_incident_reports",
      expect.anything(),
    );
  });

  it("fails closed on malformed rows", async () => {
    await expect(
      listReportsForIncidentForCurrentSession(
        incidentId,
        client({ reports: [{ report_id: "bad" }] }),
      ),
    ).resolves.toEqual({ kind: "unavailable" });
  });
});
