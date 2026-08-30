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
vi.mock("@/server/auth/private-invited-account-store", () => ({
  createAccountPasscodeResetStore: vi.fn(() => ({})),
}));
vi.mock("@/server/auth/reset-account-passcode", () => ({
  resetAccountPasscode: vi.fn(),
}));
vi.mock("@/server/auth/supabase-auth-adapters", () => ({
  createSupabaseAuthPasswordResetter: vi.fn(() => ({})),
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
import { resetAccountPasscode } from "@/server/auth/reset-account-passcode";
import { writeSafeOperationalEvent } from "@/server/observability/safe-operational-event";
import { isTrustedMutationRequest } from "@/server/security/request-origin";
import { hasValidSessionCsrfRequest } from "@/server/security/session-csrf";

import { POST } from "./route";

const origin = "https://guided-operations.example.test";
const accountId = "aaaaaaaa-0000-4000-8000-000000000001";
const proofRequestId = "dddddddd-0000-4000-8000-000000000001";
const proofToken = "x".repeat(43);
const temporaryPasscode = "FixtureResetPasscodeOnly";

describe("POST /api/admin/accounts/[accountId]/reset-passcode", () => {
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
        authUserId: "bbbbbbbb-0000-4000-8000-000000000001",
        authVersion: 3,
      },
      sessionId: "cccccccc-0000-4000-8000-000000000001",
    } as never);
    vi.mocked(isTrustedMutationRequest).mockReturnValue(true);
    vi.mocked(hasValidSessionCsrfRequest).mockReturnValue(true);
    vi.mocked(resetAccountPasscode).mockResolvedValue({
      status: "reset",
      temporaryPasscode,
      expiresAt: new Date("2026-08-29T18:30:00.000Z"),
    });
  });

  it("returns the temporary passcode once without sending it to observability", async () => {
    const response = await POST(
      new Request(`${origin}/api/admin/accounts/${accountId}/reset-passcode`, {
        method: "POST",
        body: JSON.stringify({ requestId: proofRequestId, token: proofToken }),
      }),
      { params: Promise.resolve({ accountId }) },
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("x-request-id")).toMatch(/^[0-9a-f-]{36}$/);
    await expect(response.json()).resolves.toEqual({
      data: {
        temporaryPasscode,
        temporaryPasscodeExpiresAt: "2026-08-29T18:30:00.000Z",
      },
    });
    expect(writeSafeOperationalEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        event_name: "admin.account_reset_passcode",
        outcome: "reset",
        request_id: response.headers.get("x-request-id"),
        status_code: 200,
        environment: "preview",
      }),
    );
    const serializedEvents = JSON.stringify(
      vi.mocked(writeSafeOperationalEvent).mock.calls,
    );
    expect(serializedEvents).not.toContain(accountId);
    expect(serializedEvents).not.toContain(proofRequestId);
    expect(serializedEvents).not.toContain(proofToken);
    expect(serializedEvents).not.toContain(temporaryPasscode);
  });

  it("does not consume a reset proof for an untrusted request", async () => {
    vi.mocked(isTrustedMutationRequest).mockReturnValue(false);
    const response = await POST(
      new Request(`${origin}/api/admin/accounts/${accountId}/reset-passcode`, {
        method: "POST",
      }),
      { params: Promise.resolve({ accountId }) },
    );

    expect(response.status).toBe(403);
    expect(resetAccountPasscode).not.toHaveBeenCalled();
    expect(writeSafeOperationalEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        event_name: "admin.account_reset_passcode",
        outcome: "request_not_allowed",
        status_code: 403,
      }),
    );
  });
});
