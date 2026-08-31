import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env/auth-server", () => ({
  getAuthServerEnvironment: vi.fn(),
}));
vi.mock("@/lib/env/runtime", () => ({
  getRuntimeEnvironment: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(),
}));
vi.mock("@/server/auth/current-session", () => ({
  authorizeCurrentSession: vi.fn(),
}));
vi.mock("@/server/feedback/answer-report-endpoint", () => ({
  validateAnswerReportRequest: vi.fn(),
}));
vi.mock("@/server/observability/safe-operational-event", () => ({
  writeSafeOperationalEvent: vi.fn(),
}));

import { getAuthServerEnvironment } from "@/lib/env/auth-server";
import { getRuntimeEnvironment } from "@/lib/env/runtime";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { authorizeCurrentSession } from "@/server/auth/current-session";
import { validateAnswerReportRequest } from "@/server/feedback/answer-report-endpoint";
import { writeSafeOperationalEvent } from "@/server/observability/safe-operational-event";

import { POST } from "./route";

const rpc = vi.fn();
const client = { rpc };
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

function configureSuccessfulValidation(): void {
  vi.mocked(getAuthServerEnvironment).mockReturnValue({
    SUPABASE_SECRET_KEY: "unused",
    SUPABASE_DB_URL: "https://db.example.test",
    EMPLOYEE_LOOKUP_PEPPER: "p".repeat(32),
    AUTH_DUMMY_ALIAS: "dummy@example.test",
    CSRF_HMAC_KEY: "k".repeat(32),
    AUTH_SIGN_IN_ENABLED: false,
  });
  vi.mocked(getRuntimeEnvironment).mockReturnValue({
    APP_ENV: "preview",
    APP_ORIGIN: "https://guided-operations.example.test",
  });
  vi.mocked(createSupabaseServerClient).mockResolvedValue(client as never);
  vi.mocked(authorizeCurrentSession).mockResolvedValue(session);
  vi.mocked(validateAnswerReportRequest).mockResolvedValue({
    ok: true,
    question: "Was this answer correct?",
    answerText: "The answer shown to the officer.",
    citations: [],
  });
}

describe("POST /api/web/v1/answer-reports", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    configureSuccessfulValidation();
  });

  it("maps the atomic database quota to a safe 429 response", async () => {
    rpc.mockResolvedValue({
      data: null,
      error: {
        code: "54000",
        message: "database detail must not be returned",
      },
    });

    const response = await POST(
      new Request("https://guided-operations.example.test", { method: "POST" }),
    );

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("3600");
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: "report_limit_reached",
        message: expect.not.stringContaining("database detail"),
      },
      meta: { api_version: "web-v1", request_id: expect.any(String) },
    });
    expect(writeSafeOperationalEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        event_name: "answer_report.request",
        outcome: "request_not_allowed",
        reason_code: "budget_exhausted",
        status_code: 429,
      }),
    );
  });

  it("keeps unrelated storage failures generic", async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { code: "XX000", message: "sensitive database detail" },
    });

    const response = await POST(
      new Request("https://guided-operations.example.test", { method: "POST" }),
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: "service_unavailable",
        message: expect.not.stringContaining("sensitive database detail"),
      },
    });
  });
});
