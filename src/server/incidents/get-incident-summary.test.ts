import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { getIncidentSummaryForCurrentSession } from "./get-incident-summary";

const accountRow = {
  auth_user_id: "11111111-1111-4111-8111-111111111111",
  facility_id: "22222222-2222-4222-8222-222222222222",
  role: "officer",
  status: "active",
  auth_version: 1,
  must_change_passcode: false,
};
const incidentRow = {
  incident_id: "33333333-3333-4333-8333-333333333333",
  incident_number: "F-SCOPED-001",
  display_name: "Fictional scoped incident",
  status: "in_review",
  occurred_at: "2026-08-26T12:00:00Z",
  category: "training",
  current_revision_number: 101,
  updated_at: "2026-08-30T12:00:00Z",
};

function client(options: { claims?: unknown; incident?: unknown } = {}) {
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
      return { data: options.incident ?? [incidentRow], error: null };
    }),
  };
}

describe("getIncidentSummaryForCurrentSession", () => {
  it("loads the selected authorized incident directly by id", async () => {
    const sessionClient = client();

    await expect(
      getIncidentSummaryForCurrentSession(
        incidentRow.incident_id,
        sessionClient,
      ),
    ).resolves.toEqual({
      kind: "found",
      incident: {
        incidentId: incidentRow.incident_id,
        incidentNumber: incidentRow.incident_number,
        displayName: incidentRow.display_name,
        status: incidentRow.status,
        occurredAt: incidentRow.occurred_at,
        category: incidentRow.category,
        currentRevisionNumber: incidentRow.current_revision_number,
        updatedAt: incidentRow.updated_at,
      },
    });
    expect(sessionClient.rpc).toHaveBeenLastCalledWith("get_incident_summary", {
      p_incident_id: incidentRow.incident_id,
    });
  });

  it("denies an untrusted session before the scoped RPC", async () => {
    const sessionClient = client({ claims: {} });

    await expect(
      getIncidentSummaryForCurrentSession(
        incidentRow.incident_id,
        sessionClient,
      ),
    ).resolves.toEqual({ kind: "denied" });
    expect(sessionClient.rpc).not.toHaveBeenCalledWith(
      "get_incident_summary",
      expect.anything(),
    );
  });

  it("treats an empty authorized response as not found", async () => {
    await expect(
      getIncidentSummaryForCurrentSession(
        incidentRow.incident_id,
        client({ incident: [] }),
      ),
    ).resolves.toEqual({ kind: "not_found" });
  });

  it("fails closed on malformed rows", async () => {
    await expect(
      getIncidentSummaryForCurrentSession(
        incidentRow.incident_id,
        client({ incident: [{ incident_id: "bad" }] }),
      ),
    ).resolves.toEqual({ kind: "unavailable" });
  });
});
