import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { listAdminAuditEventsForCurrentSession } from "./list-admin-audit-events";

const adminAccount = {
  auth_user_id: "11111111-1111-4111-8111-111111111111",
  facility_id: "22222222-2222-4222-8222-222222222222",
  role: "administrator",
  status: "active",
  auth_version: 1,
  must_change_passcode: false,
};
const auditRow = {
  event_id: "33333333-3333-4333-8333-333333333333",
  event_type: "account.passcode.changed",
  target_type: "account",
  outcome: "temporary_passcode_replaced",
  occurred_at: "2026-08-26T12:00:00Z",
};

function client(options: { account?: unknown; events?: unknown } = {}) {
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
        : { data: options.events ?? [auditRow], error: null },
    ),
  };
}

describe("listAdminAuditEventsForCurrentSession", () => {
  it("returns only redacted audit summary fields to an administrator", async () => {
    await expect(
      listAdminAuditEventsForCurrentSession(client(), 50),
    ).resolves.toEqual({
      kind: "listed",
      events: [
        {
          eventId: auditRow.event_id,
          eventType: auditRow.event_type,
          targetType: auditRow.target_type,
          outcome: auditRow.outcome,
          occurredAt: auditRow.occurred_at,
        },
      ],
    });
  });

  it("denies an officer before the audit-list RPC is called", async () => {
    const sessionClient = client({
      account: { ...adminAccount, role: "officer" },
    });

    await expect(
      listAdminAuditEventsForCurrentSession(sessionClient, 50),
    ).resolves.toEqual({
      kind: "denied",
    });
    expect(sessionClient.rpc).not.toHaveBeenCalledWith(
      "list_admin_audit_events",
      expect.anything(),
    );
  });

  it("fails closed on unexpected audit data", async () => {
    await expect(
      listAdminAuditEventsForCurrentSession(
        client({ events: [{ event_id: "bad" }] }),
        50,
      ),
    ).resolves.toEqual({ kind: "unavailable" });
  });
});
