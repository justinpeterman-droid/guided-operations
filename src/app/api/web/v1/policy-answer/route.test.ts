import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env/auth-server", () => ({ getAuthServerEnvironment: vi.fn() }));
vi.mock("@/lib/env/runtime", () => ({ getRuntimeEnvironment: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(),
}));
vi.mock("@/server/auth/current-session", () => ({
  authorizeCurrentSession: vi.fn(),
}));
vi.mock("@/server/ai/policy-answer-endpoint", () => ({
  validatePolicyAnswerEndpointRequest: vi.fn(),
}));
vi.mock("@/server/ai/policy-answer-service", () => ({
  createPolicyAnswerService: vi.fn(),
}));
vi.mock("@/server/ai/supabase-policy-retrieval", () => ({
  createSupabasePolicyRetrievalProvider: vi.fn(),
}));
vi.mock("@/server/ai/providers/openai-grounded-generation", () => ({
  createOpenAiGroundedGenerationProvider: vi.fn(),
}));
vi.mock("@/server/observability/safe-operational-event", () => ({
  writeSafeOperationalEvent: vi.fn(),
}));

import { getAuthServerEnvironment } from "@/lib/env/auth-server";
import { getRuntimeEnvironment } from "@/lib/env/runtime";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createPolicyAnswerService } from "@/server/ai/policy-answer-service";
import { createOpenAiGroundedGenerationProvider } from "@/server/ai/providers/openai-grounded-generation";
import { validatePolicyAnswerEndpointRequest } from "@/server/ai/policy-answer-endpoint";
import { authorizeCurrentSession } from "@/server/auth/current-session";
import { writeSafeOperationalEvent } from "@/server/observability/safe-operational-event";

import { POST } from "./route";

const client = {};
const session = {
  allowed: true as const,
  account: {
    authUserId: "11111111-1111-4111-8111-111111111111",
    facilityId: "22222222-2222-4222-8222-222222222222",
    shiftCode: null,
    role: "officer" as const,
    status: "active" as const,
    authVersion: 1,
    mustChangePasscode: false,
  },
  sessionId: "33333333-3333-4333-8333-333333333333",
};

function mockEnvironment() {
  vi.mocked(getAuthServerEnvironment).mockReturnValue({
    CSRF_HMAC_KEY: "k".repeat(32),
  } as never);
  vi.mocked(getRuntimeEnvironment).mockReturnValue({
    APP_ENV: "preview",
    APP_ORIGIN: "https://app.example.test",
  });
  vi.mocked(createSupabaseServerClient).mockResolvedValue(client as never);
}

describe("POST /api/web/v1/policy-answer", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns a validated cited answer with private no-store headers", async () => {
    mockEnvironment();
    vi.mocked(authorizeCurrentSession).mockResolvedValue(session);
    const history = [{ question: "Earlier fictional question" }];
    vi.mocked(validatePolicyAnswerEndpointRequest).mockResolvedValue({
      ok: true,
      question: "Fictional question",
      history,
    });
    const answer = {
      status: "answered" as const,
      answer: "Fictional cited answer.",
      citations: [],
      limitations: [],
    };
    const answerPolicy = vi.fn().mockResolvedValue({ kind: "answer", answer });
    vi.mocked(createPolicyAnswerService).mockReturnValue({
      answer: answerPolicy,
    });

    const response = await POST(new Request("https://app.example.test/api"));

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    await expect(response.json()).resolves.toMatchObject({
      data: { outcome: { kind: "answer", answer } },
      meta: { api_version: "web-v1", request_id: expect.any(String) },
    });
    expect(writeSafeOperationalEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        event_name: "policy_answer.request",
        outcome: "answered",
        status_code: 200,
        citation_count: 0,
      }),
    );
    expect(
      JSON.stringify(vi.mocked(writeSafeOperationalEvent).mock.calls),
    ).not.toContain("Fictional question");
    expect(
      JSON.stringify(vi.mocked(writeSafeOperationalEvent).mock.calls),
    ).not.toContain("Fictional cited answer");
    expect(
      JSON.stringify(vi.mocked(writeSafeOperationalEvent).mock.calls),
    ).not.toContain("Earlier fictional question");
    expect(answerPolicy).toHaveBeenCalledWith({
      facilityId: session.account.facilityId,
      question: "Fictional question",
      history,
    });
    expect(createOpenAiGroundedGenerationProvider).toHaveBeenCalledWith({
      accountId: session.account.authUserId,
    });
  });

  it("rejects before parsing or provider setup when the current session is denied", async () => {
    mockEnvironment();
    vi.mocked(authorizeCurrentSession).mockResolvedValue({
      allowed: false,
      reason: "missing_account",
    });

    const response = await POST(new Request("https://app.example.test/api"));

    expect(response.status).toBe(401);
    expect(validatePolicyAnswerEndpointRequest).not.toHaveBeenCalled();
    expect(createPolicyAnswerService).not.toHaveBeenCalled();
    expect(writeSafeOperationalEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        event_name: "policy_answer.request",
        outcome: "authentication_required",
        status_code: 401,
      }),
    );
  });

  it("returns an honest degraded state when the AI budget is exhausted", async () => {
    mockEnvironment();
    vi.mocked(authorizeCurrentSession).mockResolvedValue(session);
    vi.mocked(validatePolicyAnswerEndpointRequest).mockResolvedValue({
      ok: true,
      question: "Fictional question",
      history: [],
    });
    vi.mocked(createPolicyAnswerService).mockReturnValue({
      answer: vi.fn().mockResolvedValue({
        kind: "provider_unavailable",
        reasonCode: "budget_exhausted",
      }),
    });

    const response = await POST(new Request("https://app.example.test/api"));
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: "ai_temporarily_unavailable",
        message:
          "AI assistance is temporarily unavailable. Your other site tools still work.",
      },
    });
    expect(writeSafeOperationalEvent).toHaveBeenCalledWith(
      expect.objectContaining({ reason_code: "budget_exhausted" }),
    );
  });
});
