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
const bind = vi.fn();
vi.mock(
  "@/server/paperwork/private-daily-paperwork-template-step-up-target-store",
  () => ({
    createDailyPaperworkTemplateStepUpTargetStore: vi.fn(() => ({ bind })),
  }),
);
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
const session = {
  allowed: true as const,
  account: {
    authUserId: "00000000-0000-4000-8000-000000000002",
    authVersion: 1,
  },
  sessionId: "00000000-0000-4000-8000-000000000003",
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
    APP_ENV: "production",
    APP_ORIGIN: origin,
  });
  vi.mocked(createSupabaseServerClient).mockResolvedValue(client as never);
  vi.mocked(authorizeCurrentSession).mockResolvedValue(session as never);
  vi.mocked(isTrustedMutationRequest).mockReturnValue(true);
  vi.mocked(hasValidSessionCsrfRequest).mockReturnValue(true);
}

describe("POST /api/admin/daily-paperwork-template-step-up", () => {
  beforeEach(() => vi.clearAllMocks());

  it("binds the fresh import proof to the exact reviewed package digest", async () => {
    mockEnvironment();
    vi.mocked(requestAdminStepUp).mockResolvedValue({
      status: "issued",
      requestId: "00000000-0000-4000-8000-000000000004",
      token: "one-time-proof",
    });
    bind.mockResolvedValue(true);

    const response = await POST(
      new Request(`${origin}/api/admin/daily-paperwork-template-step-up`, {
        method: "POST",
        body: JSON.stringify({
          action: "import",
          passcode: "FictionalFreshPasscode9!",
          packageDigest: "a".repeat(64),
        }),
      }),
    );

    expect(requestAdminStepUp).toHaveBeenCalledWith(
      client,
      "paperwork.template_import",
      { passcode: "FictionalFreshPasscode9!" },
      expect.any(Object),
    );
    expect(bind).toHaveBeenCalledWith({
      authUserId: session.account.authUserId,
      sessionId: session.sessionId,
      authVersion: session.account.authVersion,
      purpose: "paperwork.template_import",
      requestId: "00000000-0000-4000-8000-000000000004",
      packageDigest: "a".repeat(64),
    });
    expect(response.status).toBe(200);
  });
});
