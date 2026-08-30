import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/env/auth-server", () => ({ getAuthServerEnvironment: vi.fn() }));
vi.mock("@/lib/env/runtime", () => ({ getRuntimeEnvironment: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(),
}));
vi.mock("@/server/auth/authorize-admin-invite", () => ({
  createAdminInviteAuthorization: vi.fn(() => ({})),
}));
vi.mock("@/server/auth/current-session", () => ({
  authorizeCurrentSession: vi.fn(),
}));
vi.mock("@/server/auth/invite-account", () => ({ inviteAccount: vi.fn() }));
vi.mock("@/server/auth/private-admin-step-up-store", () => ({
  createAdminStepUpStore: vi.fn(() => ({})),
}));
vi.mock("@/server/auth/private-invited-account-store", () => ({
  createInvitedAccountStore: vi.fn(() => ({})),
}));
vi.mock("@/server/auth/supabase-auth-adapters", () => ({
  createSupabaseAuthUserProvisioner: vi.fn(() => ({})),
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
import { inviteAccount } from "@/server/auth/invite-account";
import { writeSafeOperationalEvent } from "@/server/observability/safe-operational-event";
import { isTrustedMutationRequest } from "@/server/security/request-origin";
import { hasValidSessionCsrfRequest } from "@/server/security/session-csrf";

import { POST } from "./route";

const origin = "https://guided-operations.example.test";
const client = { auth: {} };
const currentSession = {
  allowed: true as const,
  account: {
    authUserId: "aaaaaaaa-0000-4000-8000-000000000001",
    authVersion: 4,
  },
  sessionId: "bbbbbbbb-0000-4000-8000-000000000001",
};
const requestBody = {
  employeeNumber: "FIXTURE-0002",
  displayName: "Fictional Officer",
  role: "officer",
  shiftCode: "A",
  requestId: "cccccccc-0000-4000-8000-000000000001",
  token: "x".repeat(43),
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

describe("POST /api/admin/accounts", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the temporary passcode once after the protected private invitation succeeds", async () => {
    mockEnvironment();
    vi.mocked(authorizeCurrentSession).mockResolvedValue(
      currentSession as never,
    );
    vi.mocked(isTrustedMutationRequest).mockReturnValue(true);
    vi.mocked(hasValidSessionCsrfRequest).mockReturnValue(true);
    vi.mocked(inviteAccount).mockImplementation(
      async (_input, dependencies) => {
        await dependencies.delivery.deliver({
          employeeNumberHint: "0002",
          temporaryPasscode: "InMemoryPasscodeOnly",
          expiresAt: new Date("2026-08-26T18:30:00.000Z"),
        });
        return { status: "activated" };
      },
    );

    const response = await POST(
      new Request(`${origin}/api/admin/accounts`, {
        method: "POST",
        body: JSON.stringify(requestBody),
      }),
    );

    expect(inviteAccount).toHaveBeenCalledWith(
      expect.objectContaining({
        employeeNumber: "FIXTURE-0002",
        employeeNumberHint: "0002",
        displayName: "Fictional Officer",
        role: "officer",
        shiftCode: "A",
      }),
      expect.objectContaining({ authorization: expect.any(Object) }),
    );
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("x-request-id")).toMatch(/^[0-9a-f-]{36}$/);
    expect(writeSafeOperationalEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        event_name: "admin.account_create",
        outcome: "created",
        request_id: response.headers.get("x-request-id"),
        status_code: 200,
        environment: "preview",
      }),
    );
    const serializedEvents = JSON.stringify(
      vi.mocked(writeSafeOperationalEvent).mock.calls,
    );
    expect(serializedEvents).not.toContain(requestBody.employeeNumber);
    expect(serializedEvents).not.toContain(requestBody.displayName);
    expect(serializedEvents).not.toContain(requestBody.requestId);
    expect(serializedEvents).not.toContain(requestBody.token);
    expect(serializedEvents).not.toContain("InMemoryPasscodeOnly");
    await expect(response.json()).resolves.toEqual({
      data: {
        employeeNumberHint: "0002",
        temporaryPasscode: "InMemoryPasscodeOnly",
        temporaryPasscodeExpiresAt: "2026-08-26T18:30:00.000Z",
      },
    });
  });

  it("does not parse or create an account before origin and CSRF checks", async () => {
    mockEnvironment();
    vi.mocked(authorizeCurrentSession).mockResolvedValue(
      currentSession as never,
    );
    vi.mocked(isTrustedMutationRequest).mockReturnValue(true);
    vi.mocked(hasValidSessionCsrfRequest).mockReturnValue(false);

    const response = await POST(
      new Request(`${origin}/api/admin/accounts`, {
        method: "POST",
        body: JSON.stringify(requestBody),
      }),
    );

    expect(response.status).toBe(403);
    expect(inviteAccount).not.toHaveBeenCalled();
    expect(writeSafeOperationalEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        event_name: "admin.account_create",
        outcome: "request_not_allowed",
        status_code: 403,
      }),
    );
  });

  it("does not create an account with malformed invite input", async () => {
    mockEnvironment();
    vi.mocked(authorizeCurrentSession).mockResolvedValue(
      currentSession as never,
    );
    vi.mocked(isTrustedMutationRequest).mockReturnValue(true);
    vi.mocked(hasValidSessionCsrfRequest).mockReturnValue(true);

    const response = await POST(
      new Request(`${origin}/api/admin/accounts`, {
        method: "POST",
        body: JSON.stringify({ ...requestBody, role: "owner" }),
      }),
    );

    expect(response.status).toBe(400);
    expect(inviteAccount).not.toHaveBeenCalled();
  });

  it("does not create an account with an unapproved shift code", async () => {
    mockEnvironment();
    vi.mocked(authorizeCurrentSession).mockResolvedValue(
      currentSession as never,
    );
    vi.mocked(isTrustedMutationRequest).mockReturnValue(true);
    vi.mocked(hasValidSessionCsrfRequest).mockReturnValue(true);

    const response = await POST(
      new Request(`${origin}/api/admin/accounts`, {
        method: "POST",
        body: JSON.stringify({ ...requestBody, shiftCode: "Z" }),
      }),
    );

    expect(response.status).toBe(400);
    expect(inviteAccount).not.toHaveBeenCalled();
  });
});
