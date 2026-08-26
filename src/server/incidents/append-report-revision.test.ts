import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { appendReportRevisionForCurrentSession } from "./append-report-revision";
const command = {
  reportId: "11111111-1111-4111-8111-111111111111",
  baseRevisionNumber: 1,
  narrative: "Fictional corrected narrative.",
  reason: "Fictional correction.",
  idempotencyKey: "fictional-revision-retry-key-1234",
};
function client(
  claims: unknown = {
    sub: "22222222-2222-4222-8222-222222222222",
    session_id: "33333333-3333-4333-8333-333333333333",
    app_metadata: { auth_version: 1 },
  },
) {
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
      getClaims: vi.fn().mockResolvedValue({ data: { claims }, error: null }),
    },
    rpc: vi.fn(async (n: string) =>
      n === "current_account"
        ? { data: [account], error: null }
        : { data: 2, error: null },
    ),
  };
}
describe("appendReportRevisionForCurrentSession", () => {
  it("maps an authorized correction to the append-only RPC", async () => {
    const c = client();
    await expect(
      appendReportRevisionForCurrentSession(
        command,
        c,
        "a-32-byte-fixture-idempotency-hmac-key",
      ),
    ).resolves.toEqual({ kind: "revised", revisionNumber: 2 });
    expect(c.rpc).toHaveBeenLastCalledWith(
      "append_report_revision",
      expect.objectContaining({
        p_report_id: command.reportId,
        p_base_revision_number: 1,
        p_narrative: command.narrative,
        p_reason: command.reason,
      }),
    );
  });
  it("denies before RPC when session claims are invalid", async () => {
    const c = client({});
    await expect(
      appendReportRevisionForCurrentSession(
        command,
        c,
        "a-32-byte-fixture-idempotency-hmac-key",
      ),
    ).resolves.toEqual({ kind: "denied" });
    expect(c.rpc).not.toHaveBeenCalledWith(
      "append_report_revision",
      expect.anything(),
    );
  });
  it("reports a stale base revision as a conflict", async () => {
    const c = client();
    c.rpc.mockImplementation((async (n: string) =>
      n === "current_account"
        ? {
            data: [
              {
                auth_user_id: "22222222-2222-4222-8222-222222222222",
                facility_id: "44444444-4444-4444-8444-444444444444",
                role: "officer",
                status: "active",
                auth_version: 1,
                must_change_passcode: false,
              },
            ],
            error: null,
          }
        : { data: null, error: { code: "40001" } }) as never);
    await expect(
      appendReportRevisionForCurrentSession(
        command,
        c,
        "a-32-byte-fixture-idempotency-hmac-key",
      ),
    ).resolves.toEqual({ kind: "conflict" });
  });
});
