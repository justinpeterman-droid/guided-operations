import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { getIncidentReportWorkspaceForCurrentSession } from "./get-incident-report-workspace";

const accountRow = {
  auth_user_id: "11111111-1111-4111-8111-111111111111",
  facility_id: "22222222-2222-4222-8222-222222222222",
  role: "administrator",
  status: "active",
  auth_version: 1,
  must_change_passcode: false,
};
const incidentId = "33333333-3333-4333-8333-333333333333";
const reportingStaffMemberId = "44444444-4444-4444-8444-444444444444";
const row = {
  incident_id: incidentId,
  incident_number: "F-WORK-001",
  display_name: "Fictional workspace scenario",
  category: "training",
  incident_revision_id: "55555555-5555-4555-8555-555555555555",
  revision_number: 1,
  schema_version: 2,
  reviewed_facts: [
    {
      id: "66666666-6666-4666-8666-666666666666",
      field: "Fictional fact",
      state: "confirmed",
      value: "Fictional confirmed value",
      sourceNoteIds: ["77777777-7777-4777-8777-777777777777"],
      reportingStaffMemberIds: [reportingStaffMemberId],
    },
  ],
  reporting_officers: [
    {
      staffMemberId: reportingStaffMemberId,
      displayName: "Fictional Reporting Officer",
      employeeNumberHint: "44",
      shiftCode: "A",
    },
  ],
};

function client(options: { claims?: unknown; workspace?: unknown } = {}) {
  return {
    auth: {
      getClaims: vi.fn().mockResolvedValue({
        data: {
          claims: options.claims ?? {
            sub: accountRow.auth_user_id,
            session_id: "88888888-8888-4888-8888-888888888888",
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
      return { data: options.workspace ?? [row], error: null };
    }),
  };
}

describe("getIncidentReportWorkspaceForCurrentSession", () => {
  it("maps the current authorized revision and minimum reporting-officer fields", async () => {
    const sessionClient = client();

    await expect(
      getIncidentReportWorkspaceForCurrentSession(incidentId, sessionClient),
    ).resolves.toEqual({
      kind: "found",
      workspace: {
        incidentId,
        incidentNumber: row.incident_number,
        displayName: row.display_name,
        category: row.category,
        incidentRevisionId: row.incident_revision_id,
        revisionNumber: 1,
        schemaVersion: 2,
        reviewedFacts: row.reviewed_facts,
        reportingOfficers: row.reporting_officers,
      },
    });
    expect(sessionClient.rpc).toHaveBeenLastCalledWith(
      "get_incident_report_workspace",
      { p_incident_id: incidentId },
    );
  });

  it("conceals invalid or unavailable incidents", async () => {
    const sessionClient = client();
    await expect(
      getIncidentReportWorkspaceForCurrentSession("not-an-id", sessionClient),
    ).resolves.toEqual({ kind: "not_found" });
    expect(sessionClient.rpc).not.toHaveBeenCalled();

    await expect(
      getIncidentReportWorkspaceForCurrentSession(
        incidentId,
        client({ workspace: [] }),
      ),
    ).resolves.toEqual({ kind: "not_found" });
  });

  it("fails closed when a version-two fact has no officer scope", async () => {
    const legacyShapedFact = {
      ...row.reviewed_facts[0],
    } as Record<string, unknown>;
    delete legacyShapedFact.reportingStaffMemberIds;

    await expect(
      getIncidentReportWorkspaceForCurrentSession(
        incidentId,
        client({
          workspace: [{ ...row, reviewed_facts: [legacyShapedFact] }],
        }),
      ),
    ).resolves.toEqual({ kind: "unavailable" });
  });

  it("denies an untrusted session before the workspace RPC", async () => {
    const sessionClient = client({ claims: {} });
    await expect(
      getIncidentReportWorkspaceForCurrentSession(incidentId, sessionClient),
    ).resolves.toEqual({ kind: "denied" });
    expect(sessionClient.rpc).not.toHaveBeenCalledWith(
      "get_incident_report_workspace",
      expect.anything(),
    );
  });
});
