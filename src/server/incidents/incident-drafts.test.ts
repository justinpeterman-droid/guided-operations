import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import {
  getIncidentDraftForCurrentSession,
  saveIncidentDraftForAuthorizedSession,
} from "./incident-drafts";
import { readDraftJson } from "./incident-draft-body";
const id = "11111111-1111-4111-8111-111111111111";
const account = {
  auth_user_id: id,
  facility_id: "22222222-2222-4222-8222-222222222222",
  role: "officer",
  status: "active",
  auth_version: 1,
  must_change_passcode: false,
};
const envelope = {
  schemaVersion: 1,
  step: 1,
  officerConfirmed: false,
  selectedRelationships: [],
  factReportingScopes: {},
  reportsReviewed: false,
  incidentNumber: "F-001",
  incidentName: "Fictional draft",
  occurredAt: "",
  location: "",
  category: "",
  categoryConfirmed: false,
  notes: "Fictional unfinished note",
  factProposals: [],
  unknown: "",
  checklistAnswers: [],
};
function client(row: unknown) {
  return {
    auth: {
      getClaims: vi.fn().mockResolvedValue({
        data: {
          claims: {
            sub: id,
            session_id: id,
            app_metadata: { auth_version: 1 },
          },
        },
        error: null,
      }),
    },
    rpc: vi.fn(async (name: string) => ({
      data: name === "current_account" ? [account] : row,
      error: null,
    })),
  };
}
const session = {
  allowed: true as const,
  account: {
    authUserId: id,
    facilityId: account.facility_id,
    role: "officer" as const,
    status: "active" as const,
    authVersion: 1,
    shiftCode: null,
    mustChangePasscode: false,
  },
  sessionId: id,
};
describe("private draft boundaries", () => {
  it("decodes the actual database read shape including schema_version", async () => {
    const c = client([
      {
        draft_id: id,
        revision_number: 1,
        schema_version: 1,
        payload: envelope,
        incident_number: "F-001",
        incident_name: "Fictional draft",
        saved_at: "2026-09-07T12:00:00Z",
      },
    ]);
    expect(await getIncidentDraftForCurrentSession(id, c)).toMatchObject({
      kind: "found",
      draft: { envelope },
    });
  });
  it("fails closed for an unsupported saved envelope", async () => {
    const c = client([
      {
        draft_id: id,
        revision_number: 1,
        schema_version: 1,
        payload: { ...envelope, schemaVersion: 2 },
        incident_number: null,
        incident_name: null,
        saved_at: "2026-09-07T12:00:00Z",
      },
    ]);
    expect(await getIncidentDraftForCurrentSession(id, c)).toEqual({
      kind: "unavailable",
    });
  });
  it("reports nullable conflict rows as conflict instead of unavailable", async () => {
    expect(
      await saveIncidentDraftForAuthorizedSession(
        { draftId: id, expectedRevision: 1, envelope },
        session,
        client([
          {
            draft_id: id,
            revision_number: null,
            saved_at: null,
            outcome: "conflict",
          },
        ]),
        "k".repeat(32),
      ),
    ).toEqual({ kind: "conflict" });
  });
  it("sends a stable first-save identity with revision zero", async () => {
    const c = client([
      {
        draft_id: id,
        revision_number: 1,
        saved_at: "2026-09-07T12:00:00Z",
        outcome: "saved",
      },
    ]);
    for (let i = 0; i < 2; i++)
      expect(
        await saveIncidentDraftForAuthorizedSession(
          { draftId: id, expectedRevision: 0, envelope },
          session,
          c,
          "k".repeat(32),
        ),
      ).toMatchObject({ kind: "saved" });
    expect(c.rpc.mock.calls[0]).toEqual(c.rpc.mock.calls[1]);
  });
  it("rejects malformed JSON and limits chunked bodies", async () => {
    expect(
      await readDraftJson(
        new Request("http://localhost", { method: "POST", body: "{" }),
      ),
    ).toEqual({ ok: false, status: 400 });
    expect(
      await readDraftJson(
        new Request("http://localhost", {
          method: "POST",
          body: "x".repeat(1048577),
        }),
      ),
    ).toEqual({ ok: false, status: 413 });
    expect(
      await readDraftJson(
        new Request("http://localhost", {
          method: "POST",
          body: JSON.stringify(envelope),
        }),
      ),
    ).toEqual({ ok: true, body: envelope });
  });
  it("does not read drafts with a revoked session", async () => {
    const c = client([]);
    c.auth.getClaims.mockResolvedValue({
      data: {
        claims: { sub: id, session_id: id, app_metadata: { auth_version: 2 } },
      },
      error: null,
    });
    expect(await getIncidentDraftForCurrentSession(id, c)).toEqual({
      kind: "denied",
    });
    expect(c.rpc).toHaveBeenCalledTimes(1);
  });
});
