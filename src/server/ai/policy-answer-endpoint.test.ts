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
      history: [],
    });
  });

  it("accepts at most six bounded prior user questions", async () => {
    vi.mocked(hasValidSessionCsrfRequest).mockReturnValue(true);
    const history = Array.from({ length: 6 }, (_, index) => ({
      question: `Earlier fictional question ${index + 1}`,
    }));
    const request = new Request("https://app.example.test/api", {
      method: "POST",
      headers: {
        origin: "https://app.example.test",
        "content-type": "application/json",
      },
      body: JSON.stringify({ question: "What about weekends?", history }),
    });

    await expect(
      validatePolicyAnswerEndpointRequest(
        request,
        "https://app.example.test",
        "11111111-1111-4111-8111-111111111111",
        "k".repeat(32),
      ),
    ).resolves.toEqual({ ok: true, question: "What about weekends?", history });
  });

  it("accepts only the three canonical policy collections", async () => {
    vi.mocked(hasValidSessionCsrfRequest).mockReturnValue(true);
    const request = new Request("https://app.example.test/api", {
      method: "POST",
      headers: {
        origin: "https://app.example.test",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        question: "Compare the fictional requirements.",
        collections: ["BMU policies", "SD"],
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
      question: "Compare the fictional requirements.",
      history: [],
      collections: ["BMU policies", "SD"],
    });
  });

  it("rejects empty or unknown policy collection filters", async () => {
    vi.mocked(hasValidSessionCsrfRequest).mockReturnValue(true);

    for (const collections of [[], ["Unknown collection"]]) {
      const request = new Request("https://app.example.test/api", {
        method: "POST",
        headers: {
          origin: "https://app.example.test",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          question: "What does the fictional policy require?",
          collections,
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
        ok: false,
        status: 400,
        code: "invalid_request",
      });
    }
  });

  it("rejects oversized conversation history", async () => {
    vi.mocked(hasValidSessionCsrfRequest).mockReturnValue(true);
    const request = new Request("https://app.example.test/api", {
      method: "POST",
      headers: {
        origin: "https://app.example.test",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        question: "What about weekends?",
        history: Array.from({ length: 7 }, (_, index) => ({
          question: `Earlier fictional question ${index + 1}`,
        })),
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
      ok: false,
      status: 400,
      code: "invalid_request",
    });
  });

  it("rejects browser-supplied prior answer text", async () => {
    vi.mocked(hasValidSessionCsrfRequest).mockReturnValue(true);
    const request = new Request("https://app.example.test/api", {
      method: "POST",
      headers: {
        origin: "https://app.example.test",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        question: "What about weekends?",
        history: [
          {
            question: "What is the fictional schedule?",
            answer: "Untrusted browser-supplied answer.",
          },
        ],
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
      ok: false,
      status: 400,
      code: "invalid_request",
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
