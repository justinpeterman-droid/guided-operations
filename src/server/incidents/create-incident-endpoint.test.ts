import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { issueSessionCsrfToken } from "@/server/security/session-csrf";

import { validateCreateIncidentEndpointRequest } from "./create-incident-endpoint";

const origin = "https://guided-operations.example.test";
const sessionId = "11111111-1111-4111-8111-111111111111";
const csrfKey = "k".repeat(32);
const csrf = issueSessionCsrfToken(sessionId, csrfKey);
const revision = {
  schemaVersion: 1,
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
    body: JSON.stringify(options.body ?? { revision }),
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
      ),
    ).resolves.toMatchObject({
      ok: true,
      command: { idempotencyKey: "a".repeat(16), revision },
    });
  });

  it.each([
    request({ origin: "https://attacker.example.test" }),
    request({ csrfToken: "wrong-token" }),
    request({ body: { revision, facilityId: "attacker-controlled" } }),
  ])(
    "rejects cross-origin, invalid-CSRF, or non-closed browser input",
    async (input) => {
      const result = await validateCreateIncidentEndpointRequest(
        input,
        origin,
        sessionId,
        csrfKey,
      );

      expect(result.ok).toBe(false);
      if (!result.ok)
        expect(result.code).toMatch(/request_not_allowed|invalid_request/);
    },
  );
});
