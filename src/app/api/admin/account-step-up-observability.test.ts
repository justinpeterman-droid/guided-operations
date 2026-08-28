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
vi.mock("@/server/observability/safe-operational-event", () => ({
  writeSafeOperationalEvent: vi.fn(),
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
import { writeSafeOperationalEvent } from "@/server/observability/safe-operational-event";
import { isTrustedMutationRequest } from "@/server/security/request-origin";
import { hasValidSessionCsrfRequest } from "@/server/security/session-csrf";

import { POST as disableStepUp } from "./account-disable-step-up/route";
import { POST as resetStepUp } from "./account-reset-passcode-step-up/route";

const origin = "https://guided-operations.example.test";
const passcode = "AdministratorPasscodeFixtureOnly";
const proofRequestId = "dddddddd-0000-4000-8000-000000000001";
const proofToken = "x".repeat(43);

describe("remaining administrator account step-up routes", () => {
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
      account: { authUserId: "aaaaaaaa-0000-4000-8000-000000000001" },
      sessionId: "bbbbbbbb-0000-4000-8000-000000000001",
    } as never);
    vi.mocked(isTrustedMutationRequest).mockReturnValue(true);
    vi.mocked(hasValidSessionCsrfRequest).mockReturnValue(true);
    vi.mocked(requestAdminStepUp).mockResolvedValue({
      status: "issued",
      requestId: proofRequestId,
      token: proofToken,
    });
  });

  it.each([
    ["disable", disableStepUp],
    ["reset", resetStepUp],
  ])(
    "preserves the %s proof response without logging secrets",
    async (_name, route) => {
      const response = await route(
        new Request(`${origin}/api/admin/account-step-up`, {
          method: "POST",
          body: JSON.stringify({ passcode }),
        }),
      );

      expect(response.status).toBe(200);
      expect(response.headers.get("cache-control")).toBe("private, no-store");
      expect(response.headers.get("x-request-id")).toMatch(/^[0-9a-f-]{36}$/u);
      await expect(response.json()).resolves.toEqual({
        data: { requestId: proofRequestId, token: proofToken },
      });
      const serializedEvents = JSON.stringify(
        vi.mocked(writeSafeOperationalEvent).mock.calls,
      );
      expect(serializedEvents).not.toContain(passcode);
      expect(serializedEvents).not.toContain(proofRequestId);
      expect(serializedEvents).not.toContain(proofToken);
    },
  );
});
