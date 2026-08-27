import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { getReportDraftCandidateForCurrentSession } from "./get-report-draft-candidate";

const row = {
  candidate_id: "11111111-1111-4111-8111-111111111111",
  incident_id: "22222222-2222-4222-8222-222222222222",
  source_incident_revision_id: "33333333-3333-4333-8333-333333333333",
  reporting_staff_member_id: "88888888-8888-4888-8888-888888888888",
  reporting_officer_display_name: "Fictional Reporting Officer",
  report_type: "cover_letter",
  source_fact_ids: ["44444444-4444-4444-8444-444444444444"],
  paragraphs: [
    {
      text: "Fictional candidate paragraph.",
      sourceFactIds: ["44444444-4444-4444-8444-444444444444"],
    },
  ],
  created_at: "2026-08-26T12:00:00Z",
};

function client(candidate: unknown = [row]) {
  const account = {
    auth_user_id: "55555555-5555-4555-8555-555555555555",
    facility_id: "66666666-6666-4666-8666-666666666666",
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
        : { data: candidate, error: null },
    ),
  };
}

describe("getReportDraftCandidateForCurrentSession", () => {
  it("maps one authorized review-only candidate", async () => {
    const sessionClient = client();
    await expect(
      getReportDraftCandidateForCurrentSession(row.candidate_id, sessionClient),
    ).resolves.toMatchObject({
      kind: "found",
      candidate: {
        candidateId: row.candidate_id,
        reportingStaffMemberId: row.reporting_staff_member_id,
        reportingOfficerDisplayName: row.reporting_officer_display_name,
        paragraphs: row.paragraphs,
      },
    });
    expect(sessionClient.rpc).toHaveBeenLastCalledWith(
      "get_report_draft_candidate",
      { p_candidate_id: row.candidate_id },
    );
  });

  it("conceals an absent or unauthorized candidate", async () => {
    await expect(
      getReportDraftCandidateForCurrentSession(row.candidate_id, client([])),
    ).resolves.toEqual({ kind: "not_found" });
  });

  it("fails closed on a stored candidate outside the controlled package", async () => {
    await expect(
      getReportDraftCandidateForCurrentSession(
        row.candidate_id,
        client([{ ...row, report_type: "invented_report" }]),
      ),
    ).resolves.toEqual({ kind: "unavailable" });
  });
});
