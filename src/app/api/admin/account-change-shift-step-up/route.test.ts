import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env/auth-server", () => ({ getAuthServerEnvironment: vi.fn() }));
vi.mock("@/lib/env/runtime", () => ({ getRuntimeEnvironment: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(),
}));
vi.mock("@/server/auth/current-session", () => ({
  authorizeCurrentSession: vi.fn(),
}));
vi.mock("@/server/auth/private-admin-step-up-store", () => ({
  createAdminStepUpStore: vi.fn(() => ({})),
}));
vi.mock("@/server/auth/request-admin-step-up", () => ({
  requestAdminStepUp: vi.fn(),
}));
vi.mock("@/server/auth/supabase-auth-adapters", () => ({
  createSupabaseAdministratorPasscodeVerifier: vi.fn(() => ({})),
}));
vi.mock("@/server/security/request-origin", () => ({
  isTrustedMutationRequest: vi.fn(),
}));
vi.mock("@/server/security/session-csrf", () => ({
  hasValidSessionCsrfRequest: vi.fn(),
}));

import { getAuthServerEnvironment } from "@/lib/env/auth-server";
import { getRuntimeEnvironment } from "@/lib/env/runtime";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { authorizeCurrentSession } from "@/server/auth/current-session";
import { requestAdminStepUp } from "@/server/auth/request-admin-step-up";
import { isTrustedMutationRequest } from "@/server/security/request-origin";
import { hasValidSessionCsrfRequest } from "@/server/security/session-csrf";

import { POST } from "./route";

const origin = "https://guided-operations.example.test";
const client = {};

describe("POST /api/admin/account-change-shift-step-up", () => {
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
  });

  it("issues only a shift-change proof after administrator, origin, and CSRF checks", async () => {
    vi.mocked(authorizeCurrentSession).mockResolvedValue({
      allowed: true,
      account: {},
      sessionId: "bbbbbbbb-0000-4000-8000-000000000001",
    } as never);
    vi.mocked(isTrustedMutationRequest).mockReturnValue(true);
    vi.mocked(hasValidSessionCsrfRequest).mockReturnValue(true);
    vi.mocked(requestAdminStepUp).mockResolvedValue({
      status: "issued",
      requestId: "cccccccc-0000-4000-8000-000000000001",
      token: "one-time-proof",
    });

    const response = await POST(
      new Request(`${origin}/api/admin/account-change-shift-step-up`, {
        method: "POST",
        body: JSON.stringify({ passcode: "FreshPasscode9!" }),
      }),
    );

    expect(requestAdminStepUp).toHaveBeenCalledWith(
      client,
      "account.change_shift",
      { passcode: "FreshPasscode9!" },
      expect.any(Object),
    );
    expect(response.status).toBe(200);
  });
});
