import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env/auth-server", () => ({ getAuthServerEnvironment: vi.fn() }));
vi.mock("@/lib/env/runtime", () => ({ getRuntimeEnvironment: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(),
}));
vi.mock("@/server/auth/current-session", () => ({
  authorizeCurrentSession: vi.fn(),
}));
vi.mock("@/server/ai/incident-fact-extraction-endpoint", () => ({
  validateIncidentFactExtractionEndpointRequest: vi.fn(),
}));
vi.mock("@/server/ai/incident-fact-extraction-service", () => ({
  createIncidentFactExtractionService: vi.fn(),
}));
vi.mock("@/server/ai/providers/openai-incident-fact-extraction", () => ({
  createOpenAiIncidentFactExtractionProvider: vi.fn(),
}));
vi.mock("@/server/observability/safe-operational-event", () => ({
  writeSafeOperationalEvent: vi.fn(),
}));

import { getAuthServerEnvironment } from "@/lib/env/auth-server";
import { getRuntimeEnvironment } from "@/lib/env/runtime";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { validateIncidentFactExtractionEndpointRequest } from "@/server/ai/incident-fact-extraction-endpoint";
import { createIncidentFactExtractionService } from "@/server/ai/incident-fact-extraction-service";
import { createOpenAiIncidentFactExtractionProvider } from "@/server/ai/providers/openai-incident-fact-extraction";
import { authorizeCurrentSession } from "@/server/auth/current-session";
import { writeSafeOperationalEvent } from "@/server/observability/safe-operational-event";

import { POST } from "./route";

const session = {
  allowed: true as const,
  account: {
    authUserId: "11111111-1111-4111-8111-111111111111",
    facilityId: "22222222-2222-4222-8222-222222222222",
  },
  sessionId: "33333333-3333-4333-8333-333333333333",
};

describe("POST /api/web/v1/incident-fact-proposals", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getAuthServerEnvironment).mockReturnValue({
      CSRF_HMAC_KEY: "c".repeat(32),
    } as never);
    vi.mocked(getRuntimeEnvironment).mockReturnValue({
      APP_ENV: "preview",
      APP_ORIGIN: "https://app.example.test",
    });
    vi.mocked(createSupabaseServerClient).mockResolvedValue({} as never);
  });

  it("returns review-only suggestions without logging notes", async () => {
    vi.mocked(authorizeCurrentSession).mockResolvedValue(session as never);
    vi.mocked(validateIncidentFactExtractionEndpointRequest).mockResolvedValue({
      ok: true,
      notes: "Fictional protected note.",
    });
    vi.mocked(createIncidentFactExtractionService).mockReturnValue({
      suggest: vi.fn().mockResolvedValue({
        kind: "suggested",
        result: {
          categoryKey: "incident_no_disciplinary",
          proposals: [
            {
              key: "field-note-line-1-fact-1",
              sourceText: "Fictional protected note.",
              value: "Fictional proposed fact.",
            },
          ],
        },
      }),
    });

    const response = await POST(new Request("https://app.example.test/api"));
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    await expect(response.json()).resolves.toMatchObject({
      data: { categoryKey: "incident_no_disciplinary" },
    });
    expect(createOpenAiIncidentFactExtractionProvider).toHaveBeenCalledWith({
      accountId: session.account.authUserId,
    });
    expect(
      JSON.stringify(vi.mocked(writeSafeOperationalEvent).mock.calls),
    ).not.toContain("Fictional protected note.");
  });

  it("returns an honest manual-review fallback when AI is disabled", async () => {
    vi.mocked(authorizeCurrentSession).mockResolvedValue(session as never);
    vi.mocked(validateIncidentFactExtractionEndpointRequest).mockResolvedValue({
      ok: true,
      notes: "Fictional note.",
    });
    vi.mocked(createIncidentFactExtractionService).mockReturnValue({
      suggest: vi.fn().mockResolvedValue({
        kind: "provider_unavailable",
        reasonCode: "generation_disabled",
      }),
    });

    const response = await POST(new Request("https://app.example.test/api"));
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: "ai_temporarily_unavailable",
        message: "AI suggestions are unavailable. Use manual review.",
      },
    });
  });
});
