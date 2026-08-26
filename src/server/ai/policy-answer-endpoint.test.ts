import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/server/security/session-csrf", () => ({
  hasValidSessionCsrfRequest: vi.fn(),
}));

import { hasValidSessionCsrfRequest } from "@/server/security/session-csrf";

import { validatePolicyAnswerEndpointRequest } from "./policy-answer-endpoint";

describe("policy answer endpoint validation", () => {
  it("requires same origin, session CSRF, JSON, and a bounded question", async () => {
    vi.mocked(hasValidSessionCsrfRequest).mockReturnValue(true);
    const request = new Request("https://app.example.test/api", {
      method: "POST",
      headers: {
        origin: "https://app.example.test",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        question: "What does the fictional policy require?",
      }),
    });

    await expect(
      validatePolicyAnswerEndpointRequest(
        request,
        "https://app.example.test",
        "11111111-1111-4111-8111-111111111111",
        "k".repeat(32),
      ),
    ).resolves.toEqual({
      ok: true,
      question: "What does the fictional policy require?",
    });
  });

  it("rejects cross-origin requests before parsing a question", async () => {
    await expect(
      validatePolicyAnswerEndpointRequest(
        new Request("https://app.example.test/api", {
          method: "POST",
          headers: { origin: "https://attacker.example.test" },
        }),
        "https://app.example.test",
        "11111111-1111-4111-8111-111111111111",
        "k".repeat(32),
      ),
    ).resolves.toEqual({ ok: false, status: 403, code: "invalid_origin" });
  });
});
