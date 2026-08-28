import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
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
const client = { auth: {} };
const currentSession = {
  allowed: true as const,
  account: { authUserId: "aaaaaaaa-0000-4000-8000-000000000001" },
  sessionId: "bbbbbbbb-0000-4000-8000-000000000001",
};

function mockEnvironment() {
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
}

describe("POST /api/admin/account-unlock-step-up", () => {
  beforeEach(() => vi.clearAllMocks());

  it("issues an unlock-only proof after the current admin, origin, and CSRF checks", async () => {
    mockEnvironment();
    vi.mocked(authorizeCurrentSession).mockResolvedValue(
      currentSession as never,
    );
    vi.mocked(isTrustedMutationRequest).mockReturnValue(true);
    vi.mocked(hasValidSessionCsrfRequest).mockReturnValue(true);
    vi.mocked(requestAdminStepUp).mockResolvedValue({
      status: "issued",
      requestId: "cccccccc-0000-4000-8000-000000000001",
      token: "one-time-proof",
    });

    const response = await POST(
      new Request(`${origin}/api/admin/account-unlock-step-up`, {
        method: "POST",
        body: JSON.stringify({ passcode: "FreshPasscode9!" }),
      }),
    );

    expect(requestAdminStepUp).toHaveBeenCalledWith(
      client,
      "account.unlock",
      { passcode: "FreshPasscode9!" },
      expect.any(Object),
    );
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    await expect(response.json()).resolves.toEqual({
      data: {
        requestId: "cccccccc-0000-4000-8000-000000000001",
        token: "one-time-proof",
      },
    });
  });

  it("does not check a passcode from an untrusted request", async () => {
    mockEnvironment();
    vi.mocked(authorizeCurrentSession).mockResolvedValue(
      currentSession as never,
    );
    vi.mocked(isTrustedMutationRequest).mockReturnValue(false);

    const response = await POST(
      new Request(`${origin}/api/admin/account-unlock-step-up`, {
        method: "POST",
        body: JSON.stringify({ passcode: "FreshPasscode9!" }),
      }),
    );

    expect(response.status).toBe(403);
    expect(requestAdminStepUp).not.toHaveBeenCalled();
  });
});
