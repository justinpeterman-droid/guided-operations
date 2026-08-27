import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { getReportForCurrentSession } from "./get-report";

const account = {
  auth_user_id: "11111111-1111-4111-8111-111111111111",
  facility_id: "22222222-2222-4222-8222-222222222222",
  role: "officer",
  status: "active",
  auth_version: 1,
  must_change_passcode: false,
};
const row = {
  report_id: "33333333-3333-4333-8333-333333333333",
  incident_id: "44444444-4444-4444-8444-444444444444",
  report_type: "cover_letter",
  status: "draft",
  revision_number: 1,
  report_revision_id: "55555555-5555-4555-8555-555555555555",
  source_incident_revision_id: "66666666-6666-4666-8666-666666666666",
  narrative: "Fictional human-reviewed final narrative.",
  schema_version: 1,
  created_at: "2026-08-26T12:00:00Z",
};

function client(report: unknown = [row]) {
  return {
    auth: {
      getClaims: vi.fn().mockResolvedValue({
        data: {
          claims: {
            sub: account.auth_user_id,
            session_id: "77777777-7777-4777-8777-777777777777",
            app_metadata: { auth_version: 1 },
          },
        },
        error: null,
      }),
    },
    rpc: vi.fn(async (name: string) =>
      name === "current_account"
        ? { data: [account], error: null }
        : { data: report, error: null },
    ),
  };
}

describe("getReportForCurrentSession", () => {
  it("maps one authorized current immutable report revision", async () => {
    const sessionClient = client();
    await expect(
      getReportForCurrentSession(row.report_id, sessionClient),
    ).resolves.toMatchObject({
      kind: "found",
      report: { reportId: row.report_id, narrative: row.narrative },
    });
    expect(sessionClient.rpc).toHaveBeenLastCalledWith("get_report", {
      p_report_id: row.report_id,
    });
  });

  it("conceals absent or unauthorized reports", async () => {
    await expect(
      getReportForCurrentSession(row.report_id, client([])),
    ).resolves.toEqual({ kind: "not_found" });
  });

  it("fails closed on malformed database output", async () => {
    await expect(
      getReportForCurrentSession(row.report_id, client([{ report_id: "bad" }])),
    ).resolves.toEqual({ kind: "unavailable" });
  });

  it("fails closed when storage returns a report outside the controlled package", async () => {
    await expect(
      getReportForCurrentSession(
        row.report_id,
        client([{ ...row, report_type: "invented_report" }]),
      ),
    ).resolves.toEqual({ kind: "unavailable" });
  });
});
