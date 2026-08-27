import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env/auth-server", () => ({ getAuthServerEnvironment: vi.fn() }));
vi.mock("@/lib/env/incident-server", () => ({
  getIncidentServerEnvironment: vi.fn(),
}));
vi.mock("@/lib/env/runtime", () => ({ getRuntimeEnvironment: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(),
}));
vi.mock("@/server/auth/current-session", () => ({
  authorizeCurrentSession: vi.fn(),
}));
vi.mock("@/server/ai/report-draft-endpoint", () => ({
  validateReportDraftEndpointRequest: vi.fn(),
}));
vi.mock("@/server/ai/persisted-report-draft-workflow", () => ({
  createPersistedReportDraftWorkflow: vi.fn(),
}));
vi.mock("@/server/ai/providers/openai-report-draft-generation", () => ({
  createOpenAiReportDraftGenerationProvider: vi.fn(),
}));
vi.mock("@/server/observability/safe-operational-event", () => ({
  writeSafeOperationalEvent: vi.fn(),
}));

import { getAuthServerEnvironment } from "@/lib/env/auth-server";
import { getIncidentServerEnvironment } from "@/lib/env/incident-server";
import { getRuntimeEnvironment } from "@/lib/env/runtime";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createPersistedReportDraftWorkflow } from "@/server/ai/persisted-report-draft-workflow";
import { createOpenAiReportDraftGenerationProvider } from "@/server/ai/providers/openai-report-draft-generation";
import { validateReportDraftEndpointRequest } from "@/server/ai/report-draft-endpoint";
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
    CSRF_HMAC_KEY: "c".repeat(32),
  } as never);
  vi.mocked(getIncidentServerEnvironment).mockReturnValue({
    INCIDENT_IDEMPOTENCY_HMAC_KEY: "i".repeat(32),
  });
  vi.mocked(getRuntimeEnvironment).mockReturnValue({
    APP_ENV: "preview",
    APP_ORIGIN: "https://app.example.test",
  });
  vi.mocked(createSupabaseServerClient).mockResolvedValue(client as never);
}

describe("POST /api/web/v1/report-drafts", () => {
  beforeEach(() => vi.clearAllMocks());

  it("stores a review-only candidate without logging request content", async () => {
    mockEnvironment();
    vi.mocked(authorizeCurrentSession).mockResolvedValue(session);
    vi.mocked(validateReportDraftEndpointRequest).mockResolvedValue({
      ok: true,
      request: {
        schemaVersion: 1,
        incidentId: "44444444-4444-4444-8444-444444444444",
        sourceIncidentRevisionId: "55555555-5555-4555-8555-555555555555",
        reportType: "Fictional protected report type",
        confirmedFactIds: ["66666666-6666-4666-8666-666666666666"],
      },
      sourceRevisionNumber: 1,
      idempotencyKey: "fictional-key-1234",
    });
    vi.mocked(createPersistedReportDraftWorkflow).mockReturnValue({
      draftAndStore: vi.fn().mockResolvedValue({
        kind: "stored",
        candidateId: "77777777-7777-4777-8777-777777777777",
      }),
    });

    const response = await POST(new Request("https://app.example.test/api"));

    expect(response.status).toBe(201);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    await expect(response.json()).resolves.toMatchObject({
      data: { candidateId: "77777777-7777-4777-8777-777777777777" },
      meta: { api_version: "web-v1", request_id: expect.any(String) },
    });
    expect(writeSafeOperationalEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        event_name: "report_draft.request",
        outcome: "stored",
        status_code: 201,
      }),
    );
    expect(
      JSON.stringify(vi.mocked(writeSafeOperationalEvent).mock.calls),
    ).not.toContain("Fictional protected report type");
    expect(createOpenAiReportDraftGenerationProvider).toHaveBeenCalledWith({
      accountId: session.account.authUserId,
    });
  });

  it("records only a bounded outcome when authentication is denied", async () => {
    mockEnvironment();
    vi.mocked(authorizeCurrentSession).mockResolvedValue({
      allowed: false,
      reason: "session_revoked",
    });

    const response = await POST(new Request("https://app.example.test/api"));

    expect(response.status).toBe(401);
    expect(validateReportDraftEndpointRequest).not.toHaveBeenCalled();
    expect(createPersistedReportDraftWorkflow).not.toHaveBeenCalled();
    expect(writeSafeOperationalEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        event_name: "report_draft.request",
        outcome: "authentication_required",
        status_code: 401,
      }),
    );
  });

  it("returns an honest degraded state when AI generation is disabled", async () => {
    mockEnvironment();
    vi.mocked(authorizeCurrentSession).mockResolvedValue(session);
    vi.mocked(validateReportDraftEndpointRequest).mockResolvedValue({
      ok: true,
      request: {
        schemaVersion: 1,
        incidentId: "44444444-4444-4444-8444-444444444444",
        sourceIncidentRevisionId: "55555555-5555-4555-8555-555555555555",
        reportType: "fictional_report",
        confirmedFactIds: ["66666666-6666-4666-8666-666666666666"],
      },
      sourceRevisionNumber: 1,
      idempotencyKey: "fictional-key-1234",
    });
    vi.mocked(createPersistedReportDraftWorkflow).mockReturnValue({
      draftAndStore: vi.fn().mockResolvedValue({
        kind: "provider_unavailable",
        reasonCode: "generation_disabled",
      }),
    });

    const response = await POST(new Request("https://app.example.test/api"));
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "ai_temporarily_unavailable" },
    });
    expect(writeSafeOperationalEvent).toHaveBeenCalledWith(
      expect.objectContaining({ reason_code: "generation_disabled" }),
    );
  });
});
