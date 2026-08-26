import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { authorizeCurrentSession } from "./current-session";

const accountRow = {
  auth_user_id: "11111111-1111-4111-8111-111111111111",
  facility_id: "22222222-2222-4222-8222-222222222222",
  role: "officer",
  status: "active",
  auth_version: 3,
  must_change_passcode: false,
};

function client(claims: unknown, rpcData: unknown = [accountRow]) {
  return {
    auth: {
      getClaims: vi.fn().mockResolvedValue({ data: { claims }, error: null }),
    },
    rpc: vi.fn().mockResolvedValue({ data: rpcData, error: null }),
  };
}

describe("authorizeCurrentSession", () => {
  it("requires matching verified claims and current account state", async () => {
    await expect(
      authorizeCurrentSession(
        client({
          sub: accountRow.auth_user_id,
          session_id: "33333333-3333-4333-8333-333333333333",
          app_metadata: { auth_version: 3 },
        }),
      ),
    ).resolves.toMatchObject({
      allowed: true,
      account: { facilityId: accountRow.facility_id },
      sessionId: "33333333-3333-4333-8333-333333333333",
    });
  });

  it.each([
    client({
      sub: accountRow.auth_user_id,
      session_id: "33333333-3333-4333-8333-333333333333",
      app_metadata: { auth_version: 2 },
    }),
    client({
      sub: "33333333-3333-4333-8333-333333333333",
      session_id: "44444444-4444-4444-8444-444444444444",
      app_metadata: { auth_version: 3 },
    }),
    client({
      sub: accountRow.auth_user_id,
      session_id: "33333333-3333-4333-8333-333333333333",
      app_metadata: {},
    }),
    client(
      {
        sub: accountRow.auth_user_id,
        session_id: "33333333-3333-4333-8333-333333333333",
        app_metadata: { auth_version: 3 },
      },
      [],
    ),
  ])(
    "fails closed when claims or account authority disagree",
    async (sessionClient) => {
      await expect(
        authorizeCurrentSession(sessionClient),
      ).resolves.toMatchObject({ allowed: false });
    },
  );
});
