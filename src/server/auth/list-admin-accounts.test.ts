import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { listAdminAccountsForCurrentSession } from "./list-admin-accounts";

const adminAccount = {
  auth_user_id: "11111111-1111-4111-8111-111111111111",
  facility_id: "22222222-2222-4222-8222-222222222222",
  role: "administrator",
  status: "active",
  auth_version: 1,
  must_change_passcode: false,
};

const accountRow = {
  account_id: "33333333-3333-4333-8333-333333333333",
  employee_number_hint: "42",
  display_name: "Fictional Officer",
  role: "officer",
  status: "active",
  must_change_passcode: false,
  updated_at: "2026-08-26T12:00:00Z",
};

function client(options: { account?: unknown; rows?: unknown } = {}) {
  return {
    auth: {
      getClaims: vi.fn().mockResolvedValue({
        data: {
          claims: {
            sub: adminAccount.auth_user_id,
            session_id: "44444444-4444-4444-8444-444444444444",
            app_metadata: { auth_version: 1 },
          },
        },
        error: null,
      }),
    },
    rpc: vi.fn(async (name: string) =>
      name === "current_account"
        ? { data: [options.account ?? adminAccount], error: null }
        : { data: options.rows ?? [accountRow], error: null },
    ),
  };
}

describe("listAdminAccountsForCurrentSession", () => {
  it("returns only the approved account summary to an administrator", async () => {
    const sessionClient = client();

    await expect(
      listAdminAccountsForCurrentSession(sessionClient, 50),
    ).resolves.toEqual({
      kind: "listed",
      accounts: [
        {
          accountId: accountRow.account_id,
          employeeNumberHint: accountRow.employee_number_hint,
          displayName: accountRow.display_name,
          role: accountRow.role,
          status: accountRow.status,
          mustChangePasscode: accountRow.must_change_passcode,
          updatedAt: accountRow.updated_at,
        },
      ],
    });
    expect(sessionClient.rpc).toHaveBeenLastCalledWith("list_admin_accounts", {
      p_limit: 50,
    });
  });

  it("denies an officer before the account-list RPC is called", async () => {
    const sessionClient = client({
      account: { ...adminAccount, role: "officer" },
    });

    await expect(
      listAdminAccountsForCurrentSession(sessionClient, 50),
    ).resolves.toEqual({ kind: "denied" });
    expect(sessionClient.rpc).not.toHaveBeenCalledWith(
      "list_admin_accounts",
      expect.anything(),
    );
  });

  it("fails closed on malformed account data", async () => {
    await expect(
      listAdminAccountsForCurrentSession(
        client({ rows: [{ account_id: "bad" }] }),
        50,
      ),
    ).resolves.toEqual({ kind: "unavailable" });
  });
});
