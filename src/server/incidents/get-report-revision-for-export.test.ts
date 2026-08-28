import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { getReportRevisionForExport } from "./get-report-revision-for-export";

const account = {
  auth_user_id: "11111111-1111-4111-8111-111111111111",
  facility_id: "22222222-2222-4222-8222-222222222222",
  shift_code: "A",
  role: "officer",
  status: "active",
  auth_version: 1,
  must_change_passcode: false,
};
const row = {
  report_id: "33333333-3333-4333-8333-333333333333",
  report_revision_id: "44444444-4444-4444-8444-444444444444",
  revision_number: 1,
  incident_number: "FICTIONAL-001",
  incident_name: "Fictional report",
  report_type: "first_person",
  narrative: "Fictional reviewed narrative.",
  schema_version: 2,
  source_incident_revision_id: "55555555-5555-4555-8555-555555555555",
  created_at: "2026-08-27T14:30:00Z",
};

function client(data: unknown, error: unknown = null) {
  return {
    auth: {
      getClaims: vi.fn().mockResolvedValue({
        data: {
          claims: {
            sub: account.auth_user_id,
            session_id: "66666666-6666-4666-8666-666666666666",
            app_metadata: { auth_version: 1 },
          },
        },
        error: null,
      }),
    },
    rpc: vi.fn(async (name: string) =>
      name === "current_account"
        ? { data: [account], error: null }
        : { data, error },
    ),
  };
}

describe("getReportRevisionForExport", () => {
  it("reads only the explicitly named authorized immutable revision", async () => {
    const current = client([row]);
    await expect(
      getReportRevisionForExport(
        { reportId: row.report_id, revisionNumber: 1 },
        current as never,
      ),
    ).resolves.toMatchObject({
      kind: "found",
      revision: { revisionNumber: 1, narrative: row.narrative },
    });
    expect(current.rpc).toHaveBeenCalledWith("get_report_revision_for_export", {
      p_report_id: row.report_id,
      p_revision_number: 1,
    });
  });

  it("rejects unsupported copy-only report types returned by a bad backend", async () => {
    await expect(
      getReportRevisionForExport(
        { reportId: row.report_id, revisionNumber: 1 },
        client([{ ...row, report_type: "disciplinary" }]) as never,
      ),
    ).resolves.toEqual({ kind: "unavailable" });
  });

  it("does not disclose whether an unauthorized revision exists", async () => {
    await expect(
      getReportRevisionForExport(
        { reportId: row.report_id, revisionNumber: 9 },
        client([]) as never,
      ),
    ).resolves.toEqual({ kind: "not_found" });
  });
});
