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
import { authorizeCurrentSession } from "@/server/auth/current-session";
import { writeSafeOperationalEvent } from "@/server/observability/safe-operational-event";
import { isTrustedMutationRequest } from "@/server/security/request-origin";
import { hasValidSessionCsrfRequest } from "@/server/security/session-csrf";

import { POST } from "./route";

const origin = "https://guided-operations.example.test";
const client = { auth: { signOut: vi.fn() } };
const session = {
  allowed: true as const,
  account: {},
  sessionId: "33333333-3333-4333-8333-333333333333",
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

describe("POST /api/auth/sign-out", () => {
  beforeEach(() => vi.clearAllMocks());

  it("requires a current account before ending a provider session", async () => {
    mockEnvironment();
    vi.mocked(authorizeCurrentSession).mockResolvedValue({
      allowed: false,
      reason: "session_revoked",
    });

    const response = await POST(new Request(`${origin}/api/auth/sign-out`));

    expect(response.status).toBe(401);
    expect(client.auth.signOut).not.toHaveBeenCalled();
    expect(writeSafeOperationalEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        event_name: "auth.sign_out",
        outcome: "authentication_required",
        status_code: 401,
      }),
    );
  });

  it("rejects a request without both same-origin and session-CSRF proof", async () => {
    mockEnvironment();
    vi.mocked(authorizeCurrentSession).mockResolvedValue(session as never);
    vi.mocked(isTrustedMutationRequest).mockReturnValue(false);
    vi.mocked(hasValidSessionCsrfRequest).mockReturnValue(true);

    const response = await POST(new Request(`${origin}/api/auth/sign-out`));

    expect(response.status).toBe(403);
    expect(client.auth.signOut).not.toHaveBeenCalled();
  });

  it("ends only the local provider session and clears local safety cookies", async () => {
    mockEnvironment();
    vi.mocked(authorizeCurrentSession).mockResolvedValue(session as never);
    vi.mocked(isTrustedMutationRequest).mockReturnValue(true);
    vi.mocked(hasValidSessionCsrfRequest).mockReturnValue(true);
    client.auth.signOut.mockResolvedValue({ error: null });

    const response = await POST(new Request(`${origin}/api/auth/sign-out`));

    expect(client.auth.signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(response.headers.get("x-request-id")).toMatch(/^[0-9a-f-]{36}$/);
    expect(response.headers.get("set-cookie")).toContain("go-csrf=;");
    expect(response.headers.get("set-cookie")).toContain("go-csrf-digest=;");
    expect(response.headers.get("set-cookie")).toContain("go-auth-device=;");
    await expect(response.json()).resolves.toEqual({
      data: { status: "signed_out" },
    });
    expect(writeSafeOperationalEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        event_name: "auth.sign_out",
        outcome: "signed_out",
        request_id: response.headers.get("x-request-id"),
        status_code: 200,
        environment: "preview",
      }),
    );
  });
});
