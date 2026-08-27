import { beforeEach, describe, expect, it, vi } from "vitest";

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
vi.mock("@/server/security/request-origin", () => ({
  isTrustedMutationRequest: vi.fn(),
}));
vi.mock("@/server/security/session-csrf", () => ({
  hasValidSessionCsrfRequest: vi.fn(),
}));
vi.mock("@/server/retention/legal-hold", () => ({
  LEGAL_HOLD_SCOPE_TYPES: [
    "facility",
    "incident",
    "report",
    "paperwork_record",
    "policy_document",
    "staff_member",
    "user_account",
  ],
  placeLegalHold: vi.fn(),
}));
vi.mock("@/server/retention/private-legal-hold-store", () => ({
  createLegalHoldStore: vi.fn(() => ({})),
}));

import { getAuthServerEnvironment } from "@/lib/env/auth-server";
import { getRuntimeEnvironment } from "@/lib/env/runtime";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createAdminActionAuthorization } from "@/server/auth/authorize-admin-action";
import { authorizeCurrentSession } from "@/server/auth/current-session";
import { isTrustedMutationRequest } from "@/server/security/request-origin";
import { hasValidSessionCsrfRequest } from "@/server/security/session-csrf";
import { placeLegalHold } from "@/server/retention/legal-hold";

import { POST } from "./route";

const origin = "https://guided-operations.example.test";
const client = { auth: {} };

describe("POST /api/admin/legal-holds", () => {
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
    vi.mocked(createSupabaseServerClient).mockResolvedValue(client as never);
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
    vi.mocked(placeLegalHold).mockResolvedValue({
      status: "placed",
      holdId: "33333333-3333-4333-8333-333333333333",
    });
  });

  it("places a hold only after session, origin, CSRF, and purpose checks", async () => {
    const response = await POST(
      new Request(`${origin}/api/admin/legal-holds`, {
        method: "POST",
        body: JSON.stringify({
          requestId: "44444444-4444-4444-8444-444444444444",
          token: "x".repeat(43),
          scopeType: "incident",
          scopeId: "55555555-5555-4555-8555-555555555555",
          authorityReference: "FICTIONAL-HOLD-001",
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(placeLegalHold).toHaveBeenCalledWith(
      expect.objectContaining({ scopeType: "incident" }),
      expect.any(Object),
    );
    expect(createAdminActionAuthorization).toHaveBeenCalledWith(
      "retention.place_legal_hold",
      expect.any(Object),
      expect.any(Object),
      expect.any(Object),
    );
  });

  it("does not consume approval for an untrusted request", async () => {
    vi.mocked(isTrustedMutationRequest).mockReturnValue(false);
    const response = await POST(
      new Request(`${origin}/api/admin/legal-holds`, { method: "POST" }),
    );

    expect(response.status).toBe(403);
    expect(placeLegalHold).not.toHaveBeenCalled();
  });
});
