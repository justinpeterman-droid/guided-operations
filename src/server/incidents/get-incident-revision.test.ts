import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { getIncidentRevisionForCurrentSession } from "./get-incident-revision";

const accountRow = {
  auth_user_id: "11111111-1111-4111-8111-111111111111",
  facility_id: "22222222-2222-4222-8222-222222222222",
  role: "officer",
  status: "active",
  auth_version: 1,
  must_change_passcode: false,
};
const revisionRow = {
  incident_id: "33333333-3333-4333-8333-333333333333",
  incident_number: "F-READ-001",
  display_name: "Fictional revision read scenario",
  incident_revision_id: "44444444-4444-4444-8444-444444444444",
  revision_number: 1,
  schema_version: 1,
  reviewed_facts: [
    {
      id: "55555555-5555-4555-8555-555555555555",
      field: "Fictional fact",
      state: "confirmed",
      value: "Fictional confirmed value",
      sourceNoteIds: ["66666666-6666-4666-8666-666666666666"],
    },
    {
      id: "77777777-7777-4777-8777-777777777777",
      field: "Fictional unknown",
      state: "unknown",
      reason: "Not available in this fictional test.",
    },
  ],
};

function client(options: { claims?: unknown; revision?: unknown } = {}) {
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
      if (name === "current_account")
        return { data: [accountRow], error: null };
      return { data: options.revision ?? [revisionRow], error: null };
    }),
  };
}

describe("getIncidentRevisionForCurrentSession", () => {
  it("maps one authorized immutable revision without returning field notes", async () => {
    const sessionClient = client();

    await expect(
      getIncidentRevisionForCurrentSession(
        { incidentId: revisionRow.incident_id, revisionNumber: 1 },
        sessionClient,
      ),
    ).resolves.toEqual({
      kind: "found",
      revision: {
        incidentId: revisionRow.incident_id,
        incidentNumber: revisionRow.incident_number,
        displayName: revisionRow.display_name,
        incidentRevisionId: revisionRow.incident_revision_id,
        revisionNumber: 1,
        schemaVersion: 1,
        reviewedFacts: revisionRow.reviewed_facts,
      },
    });
    expect(sessionClient.rpc).toHaveBeenLastCalledWith(
      "get_incident_revision",
      {
        p_incident_id: revisionRow.incident_id,
        p_revision_number: 1,
      },
    );
  });

  it("denies an untrusted session before the revision RPC", async () => {
    const sessionClient = client({ claims: {} });

    await expect(
      getIncidentRevisionForCurrentSession(
        { incidentId: revisionRow.incident_id, revisionNumber: 1 },
        sessionClient,
      ),
    ).resolves.toEqual({ kind: "denied" });
    expect(sessionClient.rpc).not.toHaveBeenCalledWith(
      "get_incident_revision",
      expect.anything(),
    );
  });

  it("conceals an absent or unauthorized revision", async () => {
    await expect(
      getIncidentRevisionForCurrentSession(
        { incidentId: revisionRow.incident_id, revisionNumber: 1 },
        client({ revision: [] }),
      ),
    ).resolves.toEqual({ kind: "not_found" });
  });

  it("fails closed on malformed database rows", async () => {
    await expect(
      getIncidentRevisionForCurrentSession(
        { incidentId: revisionRow.incident_id, revisionNumber: 1 },
        client({ revision: [{ incident_id: "bad" }] }),
      ),
    ).resolves.toEqual({ kind: "unavailable" });
  });
});
