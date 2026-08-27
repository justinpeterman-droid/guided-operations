import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { storeReportDraftCandidateForCurrentSession } from "./store-report-draft-candidate";
import type { ReportDraftSource } from "@/features/incidents/report-draft-source";

const source: ReportDraftSource = {
  incidentId: "11111111-1111-4111-8111-111111111111",
  sourceIncidentRevisionId: "22222222-2222-4222-8222-222222222222",
  reportType: "cover_letter",
  confirmedFacts: [
    {
      id: "33333333-3333-4333-8333-333333333333",
      field: "Fictional fact",
      value: "Fictional value",
      sourceNoteIds: ["44444444-4444-4444-8444-444444444444"],
    },
  ],
};
const draft = {
  paragraphs: [
    {
      text: "Fictional candidate paragraph.",
      sourceFactIds: [source.confirmedFacts[0].id],
    },
  ],
};

function client(claims: unknown = undefined) {
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
          claims: claims ?? {
            sub: account.auth_user_id,
            session_id: "77777777-7777-4777-8777-777777777777",
            app_metadata: { auth_version: 1 },
          },
        },
        error: null,
      }),
    },
    rpc: vi.fn(async (name: string) => {
      if (name === "current_account") return { data: [account], error: null };
      return { data: "88888888-8888-4888-8888-888888888888", error: null };
    }),
  };
}

describe("storeReportDraftCandidateForCurrentSession", () => {
  it("uses the current session and passes only selected fact IDs plus validated paragraph provenance", async () => {
    const sessionClient = client();
    await expect(
      storeReportDraftCandidateForCurrentSession(
        {
          source,
          draft,
          providerKey: "fictional-provider-v1",
          idempotencyKey: "fictional-retry-key-1234",
        },
        sessionClient,
        "a-32-byte-fixture-idempotency-hmac-key",
      ),
    ).resolves.toEqual({
      kind: "stored",
      candidateId: "88888888-8888-4888-8888-888888888888",
    });
    expect(sessionClient.rpc).toHaveBeenLastCalledWith(
      "store_report_draft_candidate",
      expect.objectContaining({
        p_incident_id: source.incidentId,
        p_source_incident_revision_id: source.sourceIncidentRevisionId,
        p_source_fact_ids: [source.confirmedFacts[0].id],
        p_paragraphs: draft.paragraphs,
      }),
    );
  });

  it("does not call the candidate-store RPC without trusted session claims", async () => {
    const sessionClient = client({});
    await expect(
      storeReportDraftCandidateForCurrentSession(
        {
          source,
          draft,
          providerKey: "fictional-provider-v1",
          idempotencyKey: "fictional-retry-key-1234",
        },
        sessionClient,
        "a-32-byte-fixture-idempotency-hmac-key",
      ),
    ).resolves.toEqual({ kind: "denied" });
    expect(sessionClient.rpc).not.toHaveBeenCalledWith(
      "store_report_draft_candidate",
      expect.anything(),
    );
  });

  it("rejects an invented report type before session or storage work", async () => {
    const sessionClient = client();
    await expect(
      storeReportDraftCandidateForCurrentSession(
        {
          source: { ...source, reportType: "invented_report" } as never,
          draft,
          providerKey: "fictional-provider-v1",
          idempotencyKey: "fictional-retry-key-1234",
        },
        sessionClient,
        "a-32-byte-fixture-idempotency-hmac-key",
      ),
    ).resolves.toEqual({ kind: "denied" });
    expect(sessionClient.rpc).not.toHaveBeenCalled();
  });
});
