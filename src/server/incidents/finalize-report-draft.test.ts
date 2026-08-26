import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { finalizeReportDraftForCurrentSession } from "./finalize-report-draft";

const command = {
  candidateId: "11111111-1111-4111-8111-111111111111",
  narrative: "Fictional human-reviewed final narrative.",
  idempotencyKey: "fictional-finalize-retry-key-1234",
  reviewedByOfficer: true as const,
};
function client() {
  const account = {
    auth_user_id: "22222222-2222-4222-8222-222222222222",
    facility_id: "33333333-3333-4333-8333-333333333333",
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
            session_id: "44444444-4444-4444-8444-444444444444",
            app_metadata: { auth_version: 1 },
          },
        },
        error: null,
      }),
    },
    rpc: vi.fn(async (name: string) =>
      name === "current_account"
        ? { data: [account], error: null }
        : { data: "55555555-5555-4555-8555-555555555555", error: null },
    ),
  };
}

describe("finalizeReportDraftForCurrentSession", () => {
  it("requires explicit review and sends the finalized narrative through the current-session RPC", async () => {
    const sessionClient = client();
    await expect(
      finalizeReportDraftForCurrentSession(
        command,
        sessionClient,
        "a-32-byte-fixture-idempotency-hmac-key",
      ),
    ).resolves.toEqual({
      kind: "finalized",
      reportId: "55555555-5555-4555-8555-555555555555",
    });
    expect(sessionClient.rpc).toHaveBeenLastCalledWith(
      "finalize_report_draft_candidate",
      expect.objectContaining({
        p_candidate_id: command.candidateId,
        p_narrative: command.narrative,
      }),
    );
  });

  it("refuses a report finalization without explicit human review", async () => {
    const sessionClient = client();
    await expect(
      finalizeReportDraftForCurrentSession(
        { ...command, reviewedByOfficer: false },
        sessionClient,
        "a-32-byte-fixture-idempotency-hmac-key",
      ),
    ).resolves.toEqual({ kind: "denied" });
    expect(sessionClient.rpc).not.toHaveBeenCalledWith(
      "finalize_report_draft_candidate",
      expect.anything(),
    );
  });
});
