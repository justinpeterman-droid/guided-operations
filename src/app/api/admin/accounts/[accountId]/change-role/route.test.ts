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
vi.mock("@/server/auth/change-account-role", () => ({
  changeAccountRole: vi.fn(),
}));
vi.mock("@/server/auth/current-session", () => ({
  authorizeCurrentSession: vi.fn(),
}));
vi.mock("@/server/auth/private-admin-step-up-store", () => ({
  createAdminStepUpStore: vi.fn(() => ({})),
}));
vi.mock("@/server/auth/private-invited-account-store", () => ({
  createAccountRoleChangeStore: vi.fn(() => ({})),
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
import { changeAccountRole } from "@/server/auth/change-account-role";
import { authorizeCurrentSession } from "@/server/auth/current-session";
import { writeSafeOperationalEvent } from "@/server/observability/safe-operational-event";
import { isTrustedMutationRequest } from "@/server/security/request-origin";
import { hasValidSessionCsrfRequest } from "@/server/security/session-csrf";

import { POST } from "./route";

const origin = "https://guided-operations.example.test";
const client = { auth: {} };
const accountId = "aaaaaaaa-0000-4000-8000-000000000001";

function context(id = accountId) {
  return { params: Promise.resolve({ accountId: id }) };
}

function environment() {
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

describe("POST /api/admin/accounts/[accountId]/change-role", () => {
  beforeEach(() => vi.clearAllMocks());

  it("requires a current administrator and same-site proof before changing a role", async () => {
    environment();
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
    vi.mocked(changeAccountRole).mockResolvedValue("changed");

    const response = await POST(
      new Request(`${origin}/api/admin/accounts/${accountId}/change-role`, {
        method: "POST",
        body: JSON.stringify({
          requestId: "dddddddd-0000-4000-8000-000000000001",
          token: "x".repeat(43),
          newRole: "administrator",
        }),
      }),
      context(),
    );

    expect(changeAccountRole).toHaveBeenCalledWith(
      { targetAuthUserId: accountId, newRole: "administrator" },
      expect.any(Object),
    );
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("x-request-id")).toMatch(/^[0-9a-f-]{36}$/);
    expect(writeSafeOperationalEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        event_name: "admin.account_change_role",
        outcome: "changed",
        request_id: response.headers.get("x-request-id"),
        status_code: 200,
        environment: "preview",
      }),
    );
    const serializedEvents = JSON.stringify(
      vi.mocked(writeSafeOperationalEvent).mock.calls,
    );
    expect(serializedEvents).not.toContain(accountId);
    expect(serializedEvents).not.toContain(
      "dddddddd-0000-4000-8000-000000000001",
    );
    expect(serializedEvents).not.toContain("x".repeat(43));
    expect(serializedEvents).not.toContain("administrator");
    await expect(response.json()).resolves.toEqual({
      data: { status: "changed", role: "administrator" },
    });
  });

  it("does not consume an approval for an untrusted request", async () => {
    environment();
    vi.mocked(authorizeCurrentSession).mockResolvedValue({
      allowed: true,
      account: {
        authUserId: "bbbbbbbb-0000-4000-8000-000000000001",
        authVersion: 3,
      },
      sessionId: "cccccccc-0000-4000-8000-000000000001",
    } as never);
    vi.mocked(isTrustedMutationRequest).mockReturnValue(false);

    const response = await POST(
      new Request(`${origin}/api/admin/accounts/${accountId}/change-role`, {
        method: "POST",
      }),
      context(),
    );

    expect(response.status).toBe(403);
    expect(changeAccountRole).not.toHaveBeenCalled();
    expect(writeSafeOperationalEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        event_name: "admin.account_change_role",
        outcome: "request_not_allowed",
        status_code: 403,
      }),
    );
  });
});
