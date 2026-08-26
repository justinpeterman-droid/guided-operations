import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { createIncidentForCurrentSession } from "./create-incident";

const command = {
  revision: {
    schemaVersion: 1,
    incidentName: "Fictional scenario",
    incidentNumber: "F-RPC-901",
    occurredAt: "2026-08-26T12:00:00Z",
    category: "training",
    fieldNotes: [
      {
        id: "11111111-1111-4111-8111-111111111111",
        text: "Fictional source note.",
        recordedAt: "2026-08-26T12:00:00Z",
      },
    ],
    reviewedFacts: [],
  },
  idempotencyKey: "a".repeat(16),
};

function client(
  options: { claims?: unknown; account?: unknown; incident?: unknown } = {},
) {
  const rpc = vi.fn(async (name: string) => {
    if (name === "current_account") {
      return { data: options.account ?? [accountRow], error: null };
    }
    return {
      data:
        options.incident === undefined
          ? "33333333-3333-4333-8333-333333333333"
          : options.incident,
      error: null,
    };
  });
  return {
    auth: {
      getClaims: vi.fn().mockResolvedValue({
        data: {
          claims: options.claims ?? {
            sub: accountRow.auth_user_id,
            app_metadata: { auth_version: 2 },
          },
        },
        error: null,
      }),
    },
    rpc,
  };
}

const accountRow = {
  auth_user_id: "22222222-2222-4222-8222-222222222222",
  facility_id: "44444444-4444-4444-8444-444444444444",
  role: "officer",
  status: "active",
  auth_version: 2,
  must_change_passcode: false,
};

describe("createIncidentForCurrentSession", () => {
  it("uses only the verified facility scope and opaque digests", async () => {
    const sessionClient = client();

    await expect(
      createIncidentForCurrentSession(command, sessionClient, "k".repeat(32)),
    ).resolves.toEqual({
      kind: "created",
      incidentId: "33333333-3333-4333-8333-333333333333",
    });
    expect(sessionClient.rpc).toHaveBeenLastCalledWith(
      "create_incident",
      expect.objectContaining({
        p_facility_id: accountRow.facility_id,
        p_idempotency_key_digest: expect.stringMatching(/^[a-f0-9]{64}$/),
        p_request_digest: expect.stringMatching(/^[a-f0-9]{64}$/),
      }),
    );
  });

  it("denies malformed commands or an untrusted session before create RPC", async () => {
    const malformedClient = client();
    await expect(
      createIncidentForCurrentSession({}, malformedClient, "k".repeat(32)),
    ).resolves.toEqual({ kind: "denied" });
    expect(malformedClient.rpc).not.toHaveBeenCalled();

    const deniedClient = client({
      claims: { sub: accountRow.auth_user_id, app_metadata: {} },
    });
    await expect(
      createIncidentForCurrentSession(command, deniedClient, "k".repeat(32)),
    ).resolves.toEqual({ kind: "denied" });
    expect(deniedClient.rpc).not.toHaveBeenCalledWith(
      "create_incident",
      expect.anything(),
    );
  });

  it("returns an opaque unavailable result for an invalid RPC response", async () => {
    await expect(
      createIncidentForCurrentSession(
        command,
        client({ incident: null }),
        "k".repeat(32),
      ),
    ).resolves.toEqual({ kind: "unavailable" });
  });
});
