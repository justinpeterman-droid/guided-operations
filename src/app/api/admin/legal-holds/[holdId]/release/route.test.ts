import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/env/auth-server", () => ({ getAuthServerEnvironment: vi.fn() }));
vi.mock("@/lib/env/runtime", () => ({ getRuntimeEnvironment: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(),
}));
vi.mock("@/server/auth/authorize-admin-action", () => ({
  createAdminActionAuthorization: vi.fn(() => ({})),
}));
vi.mock("@/server/auth/current-session", () => ({
  authorizeCurrentSession: vi.fn(),
}));
vi.mock("@/server/auth/private-admin-step-up-store", () => ({
  createAdminStepUpStore: vi.fn(() => ({})),
}));
vi.mock("@/server/observability/safe-operational-event", () => ({
  writeSafeOperationalEvent: vi.fn(),
}));
vi.mock("@/server/security/request-origin", () => ({
  isTrustedMutationRequest: vi.fn(),
}));
vi.mock("@/server/security/session-csrf", () => ({
  hasValidSessionCsrfRequest: vi.fn(),
}));
vi.mock("@/server/retention/legal-hold", () => ({ releaseLegalHold: vi.fn() }));
vi.mock("@/server/retention/private-legal-hold-store", () => ({
  createLegalHoldStore: vi.fn(() => ({})),
}));

import { getAuthServerEnvironment } from "@/lib/env/auth-server";
import { getRuntimeEnvironment } from "@/lib/env/runtime";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createAdminActionAuthorization } from "@/server/auth/authorize-admin-action";
import { authorizeCurrentSession } from "@/server/auth/current-session";
import { writeSafeOperationalEvent } from "@/server/observability/safe-operational-event";
import { isTrustedMutationRequest } from "@/server/security/request-origin";
import { hasValidSessionCsrfRequest } from "@/server/security/session-csrf";
import { releaseLegalHold } from "@/server/retention/legal-hold";

import { POST } from "./route";

const origin = "https://guided-operations.example.test";
const holdId = "33333333-3333-4333-8333-333333333333";

describe("POST /api/admin/legal-holds/[holdId]/release", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
      APP_ORIGIN: origin,
    });
    vi.mocked(createSupabaseServerClient).mockResolvedValue({
      auth: {},
    } as never);
    vi.mocked(authorizeCurrentSession).mockResolvedValue({
      allowed: true,
      account: {
        authUserId: "11111111-1111-4111-8111-111111111111",
        authVersion: 2,
      },
      sessionId: "22222222-2222-4222-8222-222222222222",
    } as never);
    vi.mocked(isTrustedMutationRequest).mockReturnValue(true);
    vi.mocked(hasValidSessionCsrfRequest).mockReturnValue(true);
    vi.mocked(releaseLegalHold).mockResolvedValue({ status: "released" });
  });

  it("releases a hold only through the release-specific authorization path", async () => {
    const response = await POST(
      new Request(`${origin}/api/admin/legal-holds/${holdId}/release`, {
        method: "POST",
        body: JSON.stringify({
          requestId: "44444444-4444-4444-8444-444444444444",
          token: "x".repeat(43),
          authorityReference: "FICTIONAL-RELEASE-001",
        }),
      }),
      { params: Promise.resolve({ holdId }) },
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("x-request-id")).toMatch(/^[0-9a-f-]{36}$/);
    expect(releaseLegalHold).toHaveBeenCalledWith(
      { holdId, authorityReference: "FICTIONAL-RELEASE-001" },
      expect.any(Object),
    );
    expect(createAdminActionAuthorization).toHaveBeenCalledWith(
      "retention.release_legal_hold",
      expect.any(Object),
      expect.any(Object),
      expect.any(Object),
    );
    expect(writeSafeOperationalEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        event_name: "admin.legal_hold_release",
        outcome: "released",
        request_id: response.headers.get("x-request-id"),
        status_code: 200,
        environment: "preview",
      }),
    );
    expect(
      JSON.stringify(vi.mocked(writeSafeOperationalEvent).mock.calls),
    ).not.toContain(holdId);
  });

  it("rejects a malformed hold ID before authorization", async () => {
    const response = await POST(
      new Request(`${origin}/api/admin/legal-holds/not-a-uuid/release`, {
        method: "POST",
      }),
      { params: Promise.resolve({ holdId: "not-a-uuid" }) },
    );

    expect(response.status).toBe(400);
    expect(releaseLegalHold).not.toHaveBeenCalled();
    expect(writeSafeOperationalEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        event_name: "admin.legal_hold_release",
        outcome: "validation_rejected",
        status_code: 400,
      }),
    );
  });
});
