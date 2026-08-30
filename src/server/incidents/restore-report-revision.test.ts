import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { restoreReportRevisionForCurrentSession } from "./restore-report-revision";

const command = {
  reportId: "11111111-1111-4111-8111-111111111111",
  baseRevisionNumber: 2,
  restoreRevisionNumber: 1,
  reason: "Fictional restore after review.",
  idempotencyKey: "fictional-restore-retry-key-1234",
};
function client(error: unknown | null = null) {
  const account = {
    auth_user_id: "22222222-2222-4222-8222-222222222222",
    facility_id: "44444444-4444-4444-8444-444444444444",
    role: "officer",
    status: "active",
    auth_version: 1,
    must_change_passcode: false,
  };
  return {
    auth: {
      getClaims: vi.fn().mockResolvedValue({
        data: {
          claims: {
            sub: account.auth_user_id,
            session_id: "33333333-3333-4333-8333-333333333333",
            app_metadata: { auth_version: 1 },
          },
        },
        error: null,
      }),
    },
    rpc: vi.fn(async (name: string) =>
      name === "current_account"
        ? { data: [account], error: null }
        : { data: error ? null : 3, error },
    ),
  };
}

describe("restoreReportRevisionForCurrentSession", () => {
  it("maps an authorized restore to the protected RPC", async () => {
    const c = client();
    await expect(
      restoreReportRevisionForCurrentSession(
        command,
        c,
        "a-32-byte-fixture-idempotency-hmac-key",
      ),
    ).resolves.toEqual({ kind: "restored", revisionNumber: 3 });
    expect(c.rpc).toHaveBeenLastCalledWith(
      "restore_report_revision",
      expect.objectContaining({
        p_report_id: command.reportId,
        p_base_revision_number: 2,
        p_restore_revision_number: 1,
        p_reason: command.reason,
      }),
    );
  });

  it("maps a stale restore to a safe conflict", async () => {
    await expect(
      restoreReportRevisionForCurrentSession(
        command,
        client({ code: "40001" }),
        "a-32-byte-fixture-idempotency-hmac-key",
      ),
    ).resolves.toEqual({ kind: "conflict" });
  });
});
