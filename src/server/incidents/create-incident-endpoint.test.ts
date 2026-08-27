import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { issueSessionCsrfToken } from "@/server/security/session-csrf";

import { validateCreateIncidentEndpointRequest } from "./create-incident-endpoint";

const origin = "https://guided-operations.example.test";
const sessionId = "11111111-1111-4111-8111-111111111111";
const csrfKey = "k".repeat(32);
const csrf = issueSessionCsrfToken(sessionId, csrfKey);
const revision = {
  schemaVersion: 2,
  incidentName: "Fictional training scenario",
  incidentNumber: "F-INC-101",
  occurredAt: "2026-08-26T12:00:00Z",
  category: "training",
  fieldNotes: [
    {
      id: "22222222-2222-4222-8222-222222222222",
      text: "Fictional source note.",
      recordedAt: "2026-08-26T12:00:00Z",
    },
  ],
  reviewedFacts: [],
};
const staffRelationships = [
  {
    staffMemberId: "22222222-2222-4222-8222-222222222222",
    relationship: "reporting_officer",
  },
  {
    staffMemberId: "22222222-2222-4222-8222-222222222222",
    relationship: "preparer",
  },
];

function request(
  options: { origin?: string; csrfToken?: string; body?: unknown } = {},
) {
  return new Request(`${origin}/api/web/v1/incidents`, {
    method: "POST",
    headers: {
      origin: options.origin ?? origin,
      "content-type": "application/json",
      "idempotency-key": "a".repeat(16),
      "x-csrf-token": options.csrfToken ?? csrf.token,
      cookie: `go-csrf-digest=${csrf.digest}`,
    },
    body: JSON.stringify(options.body ?? { revision, staffRelationships }),
  });
}

describe("validateCreateIncidentEndpointRequest", () => {
  it("accepts only a same-origin, session-bound, closed incident request", async () => {
    await expect(
      validateCreateIncidentEndpointRequest(
        request(),
        origin,
        sessionId,
        csrfKey,
        "preview",
      ),
    ).resolves.toMatchObject({
      ok: true,
      command: {
        idempotencyKey: "a".repeat(16),
        revision,
        staffRelationships,
      },
    });
  });

  it.each([
    request({ origin: "https://attacker.example.test" }),
    request({ csrfToken: "wrong-token" }),
    request({
      body: { revision, staffRelationships, facilityId: "attacker-controlled" },
    }),
  ])(
    "rejects cross-origin, invalid-CSRF, or non-closed browser input",
    async (input) => {
      const result = await validateCreateIncidentEndpointRequest(
        input,
        origin,
        sessionId,
        csrfKey,
        "preview",
      );

      expect(result.ok).toBe(false);
      if (!result.ok)
        expect(result.code).toMatch(/request_not_allowed|invalid_request/);
    },
  );

  it("keeps the legacy-derived candidate checklist out of Production", async () => {
    const candidateRevision = {
      ...revision,
      category: "incident_no_disciplinary",
      reviewedFacts: [
        {
          id: "33333333-3333-4333-8333-333333333333",
          field:
            "[report-checklist:bmu-legacy-candidate@1:medical_disposition] Medical disposition",
          state: "unknown",
          reason: "Officer marked this checklist item Unknown.",
        },
        {
          id: "44444444-4444-4444-8444-444444444444",
          field:
            "[report-checklist:bmu-legacy-candidate@1:investigation_occurred] Investigation occurred",
          state: "unknown",
          reason: "Officer marked this checklist item Unknown.",
        },
      ],
    };

    await expect(
      validateCreateIncidentEndpointRequest(
        request({ body: { revision: candidateRevision, staffRelationships } }),
        origin,
        sessionId,
        csrfKey,
        "production",
      ),
    ).resolves.toEqual({
      ok: false,
      status: 403,
      code: "checklist_not_approved",
    });

    await expect(
      validateCreateIncidentEndpointRequest(
        request({ body: { revision: candidateRevision, staffRelationships } }),
        origin,
        sessionId,
        csrfKey,
        "preview",
      ),
    ).resolves.toMatchObject({ ok: true });
  });
});
