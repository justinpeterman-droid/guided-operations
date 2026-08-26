import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { loadCurrentAccountFromRpc } from "./current-account-rpc";

const row = {
  auth_user_id: "11111111-1111-4111-8111-111111111111",
  facility_id: "22222222-2222-4222-8222-222222222222",
  role: "officer",
  status: "active",
  auth_version: 3,
  must_change_passcode: false,
};

describe("loadCurrentAccountFromRpc", () => {
  it("maps the minimum authoritative RPC row", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [row], error: null });

    await expect(loadCurrentAccountFromRpc({ rpc })).resolves.toEqual({
      authUserId: row.auth_user_id,
      facilityId: row.facility_id,
      role: "officer",
      status: "active",
      authVersion: 3,
      mustChangePasscode: false,
    });
    expect(rpc).toHaveBeenCalledWith("current_account");
  });

  it.each([
    { data: [], error: null },
    { data: [{ ...row, role: "invented" }], error: null },
    { data: [row, row], error: null },
    { data: null, error: { message: "private" } },
  ])(
    "fails closed for an unavailable or malformed response",
    async (result) => {
      await expect(
        loadCurrentAccountFromRpc({ rpc: vi.fn().mockResolvedValue(result) }),
      ).resolves.toBeNull();
    },
  );
});
