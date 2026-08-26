import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env/auth-server", () => ({ getAuthServerEnvironment: vi.fn() }));
vi.mock("@/lib/env/runtime", () => ({ getRuntimeEnvironment: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(),
}));
vi.mock("@/server/auth/authorize-admin-action", () => ({
  createAdminActionAuthorization: vi.fn(() => ({})),
}));
vi.mock("@/server/auth/change-account-shift", () => ({
  changeAccountShift: vi.fn(),
}));
vi.mock("@/server/auth/current-session", () => ({
  authorizeCurrentSession: vi.fn(),
}));
vi.mock("@/server/auth/private-admin-step-up-store", () => ({
  createAdminStepUpStore: vi.fn(() => ({})),
}));
vi.mock("@/server/auth/private-invited-account-store", () => ({
  createAccountShiftChangeStore: vi.fn(() => ({})),
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
import { changeAccountShift } from "@/server/auth/change-account-shift";
import { authorizeCurrentSession } from "@/server/auth/current-session";
import { isTrustedMutationRequest } from "@/server/security/request-origin";
import { hasValidSessionCsrfRequest } from "@/server/security/session-csrf";

import { POST } from "./route";

const origin = "https://guided-operations.example.test";
const accountId = "aaaaaaaa-0000-4000-8000-000000000001";
const client = {};

describe("POST /api/admin/accounts/[accountId]/change-shift", () => {
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

  it("uses one same-session proof for one approved shift change", async () => {
    vi.mocked(authorizeCurrentSession).mockResolvedValue({
      allowed: true,
      account: {
        authUserId: "bbbbbbbb-0000-4000-8000-000000000001",
        authVersion: 3,
      },
      sessionId: "cccccccc-0000-4000-8000-000000000001",
    } as never);
    vi.mocked(isTrustedMutationRequest).mockReturnValue(true);
    vi.mocked(hasValidSessionCsrfRequest).mockReturnValue(true);
    vi.mocked(changeAccountShift).mockResolvedValue("changed");

    const response = await POST(
      new Request(`${origin}/api/admin/accounts/${accountId}/change-shift`, {
        method: "POST",
        body: JSON.stringify({
          requestId: "dddddddd-0000-4000-8000-000000000001",
          token: "x".repeat(43),
          newShiftCode: "F",
        }),
      }),
      { params: Promise.resolve({ accountId }) },
    );

    expect(changeAccountShift).toHaveBeenCalledWith(
      { targetAuthUserId: accountId, newShiftCode: "F" },
      expect.any(Object),
    );
    await expect(response.json()).resolves.toEqual({
      data: { status: "changed", shiftCode: "F" },
    });
  });
});
