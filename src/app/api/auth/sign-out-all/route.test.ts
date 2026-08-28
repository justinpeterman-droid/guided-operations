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
vi.mock("@/server/auth/personal-session-revocation-store", () => ({
  createPersonalSessionRevocationStore: vi.fn(),
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
import { createPersonalSessionRevocationStore } from "@/server/auth/personal-session-revocation-store";
import { writeSafeOperationalEvent } from "@/server/observability/safe-operational-event";
import { isTrustedMutationRequest } from "@/server/security/request-origin";
import { hasValidSessionCsrfRequest } from "@/server/security/session-csrf";

import { POST } from "./route";

const origin = "https://guided-operations.example.test";
const client = { auth: { signOut: vi.fn() } };
const revocationStore = { beginAll: vi.fn(), completeAll: vi.fn() };
const session = {
  allowed: true as const,
  account: {
    authUserId: "11111111-1111-4111-8111-111111111111",
    authVersion: 4,
  },
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
  vi.mocked(createPersonalSessionRevocationStore).mockReturnValue(
    revocationStore,
  );
}

describe("POST /api/auth/sign-out-all", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    revocationStore.beginAll.mockResolvedValue(5);
    revocationStore.completeAll.mockResolvedValue(6);
  });

  it("requires the current session before attempting account-wide revocation", async () => {
    mockEnvironment();
    vi.mocked(authorizeCurrentSession).mockResolvedValue({
      allowed: false,
      reason: "session_revoked",
    });

    const response = await POST(new Request(`${origin}/api/auth/sign-out-all`));

    expect(response.status).toBe(401);
    expect(revocationStore.beginAll).not.toHaveBeenCalled();
    expect(revocationStore.completeAll).not.toHaveBeenCalled();
    expect(client.auth.signOut).not.toHaveBeenCalled();
  });

  it("requires exact origin and session CSRF proof before revoking sessions", async () => {
    mockEnvironment();
    vi.mocked(authorizeCurrentSession).mockResolvedValue(session as never);
    vi.mocked(isTrustedMutationRequest).mockReturnValue(true);
    vi.mocked(hasValidSessionCsrfRequest).mockReturnValue(false);

    const response = await POST(new Request(`${origin}/api/auth/sign-out-all`));

    expect(response.status).toBe(403);
    expect(revocationStore.beginAll).not.toHaveBeenCalled();
    expect(revocationStore.completeAll).not.toHaveBeenCalled();
    expect(client.auth.signOut).not.toHaveBeenCalled();
  });

  it("fails closed before provider sign-out when authoritative revocation is unavailable", async () => {
    mockEnvironment();
    vi.mocked(authorizeCurrentSession).mockResolvedValue(session as never);
    vi.mocked(isTrustedMutationRequest).mockReturnValue(true);
    vi.mocked(hasValidSessionCsrfRequest).mockReturnValue(true);
    revocationStore.beginAll.mockRejectedValue(new Error("unavailable"));

    const response = await POST(new Request(`${origin}/api/auth/sign-out-all`));

    expect(response.status).toBe(503);
    expect(revocationStore.completeAll).not.toHaveBeenCalled();
    expect(client.auth.signOut).not.toHaveBeenCalled();
    expect(writeSafeOperationalEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        event_name: "auth.sign_out_all",
        outcome: "service_unavailable",
        status_code: 503,
      }),
    );
  });

  it("does not seal the intermediate generation when provider revocation fails", async () => {
    mockEnvironment();
    vi.mocked(authorizeCurrentSession).mockResolvedValue(session as never);
    vi.mocked(isTrustedMutationRequest).mockReturnValue(true);
    vi.mocked(hasValidSessionCsrfRequest).mockReturnValue(true);
    client.auth.signOut.mockResolvedValue({ error: new Error("unavailable") });

    const response = await POST(new Request(`${origin}/api/auth/sign-out-all`));

    expect(response.status).toBe(503);
    expect(revocationStore.beginAll).toHaveBeenCalled();
    expect(revocationStore.completeAll).not.toHaveBeenCalled();
  });

  it("does not claim success when the final authority seal fails", async () => {
    mockEnvironment();
    vi.mocked(authorizeCurrentSession).mockResolvedValue(session as never);
    vi.mocked(isTrustedMutationRequest).mockReturnValue(true);
    vi.mocked(hasValidSessionCsrfRequest).mockReturnValue(true);
    client.auth.signOut.mockResolvedValue({ error: null });
    revocationStore.completeAll.mockRejectedValue(new Error("unavailable"));

    const response = await POST(new Request(`${origin}/api/auth/sign-out-all`));

    expect(response.status).toBe(503);
    expect(client.auth.signOut).toHaveBeenCalledWith({ scope: "global" });
  });

  it("revokes all provider sessions and clears local safety cookies", async () => {
    mockEnvironment();
    vi.mocked(authorizeCurrentSession).mockResolvedValue(session as never);
    vi.mocked(isTrustedMutationRequest).mockReturnValue(true);
    vi.mocked(hasValidSessionCsrfRequest).mockReturnValue(true);
    client.auth.signOut.mockResolvedValue({ error: null });

    const response = await POST(new Request(`${origin}/api/auth/sign-out-all`));

    expect(revocationStore.beginAll).toHaveBeenCalledWith(
      session.account.authUserId,
      session.account.authVersion,
    );
    expect(revocationStore.completeAll).toHaveBeenCalledWith(
      session.account.authUserId,
      5,
    );
    expect(client.auth.signOut).toHaveBeenCalledWith({ scope: "global" });
    expect(revocationStore.beginAll.mock.invocationCallOrder[0]).toBeLessThan(
      client.auth.signOut.mock.invocationCallOrder[0],
    );
    expect(client.auth.signOut.mock.invocationCallOrder[0]).toBeLessThan(
      revocationStore.completeAll.mock.invocationCallOrder[0],
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(response.headers.get("x-request-id")).toMatch(/^[0-9a-f-]{36}$/);
    expect(response.headers.get("set-cookie")).toContain("go-csrf=;");
    expect(response.headers.get("set-cookie")).toContain("go-csrf-digest=;");
    expect(response.headers.get("set-cookie")).toContain("go-auth-device=;");
    await expect(response.json()).resolves.toEqual({
      data: { status: "signed_out_everywhere" },
    });
    expect(writeSafeOperationalEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        event_name: "auth.sign_out_all",
        outcome: "signed_out_everywhere",
        request_id: response.headers.get("x-request-id"),
        status_code: 200,
        environment: "preview",
      }),
    );
  });
});
