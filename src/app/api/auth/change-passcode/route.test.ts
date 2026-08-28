import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/env/auth-server", () => ({ getAuthServerEnvironment: vi.fn() }));
vi.mock("@/lib/env/runtime", () => ({ getRuntimeEnvironment: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(),
}));
vi.mock("@/server/auth/change-personal-passcode", () => ({
  changePersonalPasscode: vi.fn(),
}));
vi.mock("@/server/auth/current-session", () => ({
  authorizeCurrentSession: vi.fn(),
}));
vi.mock("@/server/auth/personal-passcode-change-store", () => ({
  createPersonalPasscodeChangeStore: vi.fn(() => ({})),
}));
vi.mock("@/server/auth/supabase-auth-adapters", () => ({
  createSupabaseAccountPasscodeVerifier: vi.fn(() => ({})),
  createSupabaseAuthPasswordResetter: vi.fn(() => ({})),
}));
vi.mock("@/server/observability/safe-operational-event", () => ({
  writeSafeOperationalEvent: vi.fn(),
}));
vi.mock("@/server/security/request-origin", () => ({
  isTrustedMutationRequest: vi.fn(),
}));
vi.mock("@/server/security/session-csrf", () => ({
  CSRF_DIGEST_COOKIE: "go-csrf-digest",
  CSRF_TOKEN_COOKIE: "go-csrf",
  hasValidSessionCsrfRequest: vi.fn(),
}));

import { getAuthServerEnvironment } from "@/lib/env/auth-server";
import { getRuntimeEnvironment } from "@/lib/env/runtime";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { changePersonalPasscode } from "@/server/auth/change-personal-passcode";
import { authorizeCurrentSession } from "@/server/auth/current-session";
import { writeSafeOperationalEvent } from "@/server/observability/safe-operational-event";
import { isTrustedMutationRequest } from "@/server/security/request-origin";
import { hasValidSessionCsrfRequest } from "@/server/security/session-csrf";

import { POST } from "./route";

const origin = "https://guided-operations.example.test";
const client = { auth: {} };
const session = {
  allowed: true as const,
  account: { authUserId: "aaaaaaaa-0000-4000-8000-000000000001" },
  sessionId: "bbbbbbbb-0000-4000-8000-000000000001",
};

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

describe("POST /api/auth/change-passcode", () => {
  beforeEach(() => vi.clearAllMocks());

  it("requires the current session, exact origin, and CSRF before changing", async () => {
    environment();
    vi.mocked(authorizeCurrentSession).mockResolvedValue(session as never);
    vi.mocked(isTrustedMutationRequest).mockReturnValue(true);
    vi.mocked(hasValidSessionCsrfRequest).mockReturnValue(true);
    vi.mocked(changePersonalPasscode).mockResolvedValue("changed");
    const body = {
      employeeNumber: "EMP-42",
      currentPasscode: "Current9!",
      newPasscode: "Cedar7!9",
    };

    const response = await POST(
      new Request(`${origin}/api/auth/change-passcode`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    );

    expect(changePersonalPasscode).toHaveBeenCalledWith(
      body,
      session.account.authUserId,
      client,
      expect.any(Object),
    );
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("x-request-id")).toMatch(/^[0-9a-f-]{36}$/);
    expect(response.headers.get("set-cookie")).toContain("go-csrf=;");
    expect(writeSafeOperationalEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        event_name: "auth.passcode_change",
        outcome: "changed",
        request_id: response.headers.get("x-request-id"),
        status_code: 200,
        duration_ms: expect.any(Number),
        environment: "preview",
      }),
    );
    expect(
      JSON.stringify(vi.mocked(writeSafeOperationalEvent).mock.calls),
    ).not.toContain(body.currentPasscode);
    await expect(response.json()).resolves.toEqual({
      data: { status: "passcode_changed" },
    });
  });

  it("rejects an untrusted request before checking any passcode", async () => {
    environment();
    vi.mocked(authorizeCurrentSession).mockResolvedValue(session as never);
    vi.mocked(isTrustedMutationRequest).mockReturnValue(false);

    const response = await POST(
      new Request(`${origin}/api/auth/change-passcode`, { method: "POST" }),
    );

    expect(response.status).toBe(403);
    expect(changePersonalPasscode).not.toHaveBeenCalled();
    expect(writeSafeOperationalEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        event_name: "auth.passcode_change",
        outcome: "request_not_allowed",
        status_code: 403,
      }),
    );
  });
});
