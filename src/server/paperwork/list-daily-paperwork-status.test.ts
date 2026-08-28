import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { dailyPaperworkCatalog } from "@/features/daily-paperwork/catalog";
import { listDailyPaperworkStatusForCurrentSession } from "./list-daily-paperwork-status";

const adminAccount = {
  auth_user_id: "11111111-1111-4111-8111-111111111111",
  facility_id: "22222222-2222-4222-8222-222222222222",
  role: "administrator",
  status: "active",
  auth_version: 1,
  must_change_passcode: false,
  shift_code: "A",
};

const rows = dailyPaperworkCatalog.map((item, index) => ({
  template_code: item.kind,
  display_title: item.title,
  configured: index === 0,
  template_id: index === 0 ? "33333333-3333-4333-8333-333333333333" : null,
  template_version: index === 0 ? 1 : null,
  print_orientation: index === 0 ? "landscape" : null,
  capabilities: index === 0 ? ["screen", "print"] : [],
  record_id: null,
  current_revision_number: null,
  updated_at: null,
}));

function client(options: { account?: unknown; statusRows?: unknown } = {}) {
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
        : { data: options.statusRows ?? rows, error: null },
    ),
  };
}

describe("listDailyPaperworkStatusForCurrentSession", () => {
  it("returns the bounded six-form status catalog to an administrator", async () => {
    const result = await listDailyPaperworkStatusForCurrentSession(
      { workDate: "2026-08-27", shiftCode: "A" },
      client(),
    );

    expect(result.kind).toBe("listed");
    if (result.kind !== "listed") throw new Error("Expected listed status");
    expect(result.forms).toHaveLength(6);
    expect(result.forms[0]).toMatchObject({
      kind: "assignment_roster",
      configured: true,
      templateVersion: 1,
      recordId: null,
    });
  });

  it("denies an officer before the Daily Paperwork RPC", async () => {
    const sessionClient = client({
      account: { ...adminAccount, role: "officer" },
    });

    await expect(
      listDailyPaperworkStatusForCurrentSession(
        { workDate: "2026-08-27", shiftCode: "A" },
        sessionClient,
      ),
    ).resolves.toEqual({ kind: "denied" });
    expect(sessionClient.rpc).not.toHaveBeenCalledWith(
      "list_daily_paperwork_status_v2",
      expect.anything(),
    );
  });

  it("rejects an unapproved shift before any authorization work", async () => {
    const sessionClient = client();
    await expect(
      listDailyPaperworkStatusForCurrentSession(
        { workDate: "2026-08-27", shiftCode: "Z" },
        sessionClient,
      ),
    ).resolves.toEqual({ kind: "denied" });
    expect(sessionClient.auth.getClaims).not.toHaveBeenCalled();
  });

  it("fails closed when the database omits or reorders a form", async () => {
    await expect(
      listDailyPaperworkStatusForCurrentSession(
        { workDate: "2026-08-27", shiftCode: "A" },
        client({ statusRows: rows.slice(1) }),
      ),
    ).resolves.toEqual({ kind: "unavailable" });
  });

  it("fails closed on inconsistent template or record metadata", async () => {
    await expect(
      listDailyPaperworkStatusForCurrentSession(
        { workDate: "2026-08-27", shiftCode: "A" },
        client({
          statusRows: [{ ...rows[0], configured: false }, ...rows.slice(1)],
        }),
      ),
    ).resolves.toEqual({ kind: "unavailable" });
  });
});
