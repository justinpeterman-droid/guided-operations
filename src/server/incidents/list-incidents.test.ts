import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { listIncidentsForCurrentSession } from "./list-incidents";

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
  incident_number: "F-LIST-001",
  display_name: "Fictional training scenario",
  status: "draft",
  occurred_at: "2026-08-26T12:00:00Z",
  category: "training",
  current_revision_number: 1,
  updated_at: "2026-08-26T12:00:00Z",
};

function client(options: { claims?: unknown; incidents?: unknown } = {}) {
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
      if (name === "current_account")
        return { data: [accountRow], error: null };
      return { data: options.incidents ?? [incidentRow], error: null };
    }),
  };
}

describe("listIncidentsForCurrentSession", () => {
  it("maps only authorized summary fields from the narrow list RPC", async () => {
    const sessionClient = client();

    await expect(
      listIncidentsForCurrentSession(sessionClient, 50),
    ).resolves.toEqual({
      kind: "listed",
      incidents: [
        {
          incidentId: incidentRow.incident_id,
          incidentNumber: incidentRow.incident_number,
          displayName: incidentRow.display_name,
          status: incidentRow.status,
          occurredAt: incidentRow.occurred_at,
          category: incidentRow.category,
          currentRevisionNumber: incidentRow.current_revision_number,
          updatedAt: incidentRow.updated_at,
        },
      ],
    });
    expect(sessionClient.rpc).toHaveBeenLastCalledWith("list_incidents", {
      p_limit: 50,
    });
  });

  it("denies an untrusted session before the list RPC", async () => {
    const sessionClient = client({ claims: {} });

    await expect(
      listIncidentsForCurrentSession(sessionClient, 50),
    ).resolves.toEqual({
      kind: "denied",
    });
    expect(sessionClient.rpc).not.toHaveBeenCalledWith(
      "list_incidents",
      expect.anything(),
    );
  });

  it("fails closed on malformed list rows", async () => {
    await expect(
      listIncidentsForCurrentSession(
        client({ incidents: [{ incident_id: "bad" }] }),
        50,
      ),
    ).resolves.toEqual({ kind: "unavailable" });
  });
});
