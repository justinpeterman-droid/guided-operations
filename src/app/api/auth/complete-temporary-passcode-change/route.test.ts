import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env/auth-server", () => ({ getAuthServerEnvironment: vi.fn() }));
vi.mock("@/lib/env/runtime", () => ({ getRuntimeEnvironment: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(),
}));
vi.mock("@/server/auth/complete-temporary-passcode-change", () => ({
  completeTemporaryPasscodeChange: vi.fn(),
}));
vi.mock("@/server/auth/current-session", () => ({
  authorizeCurrentSession: vi.fn(),
}));
vi.mock("@/server/auth/private-passcode-change-store", () => ({
  createTemporaryPasscodeChangeStore: vi.fn(() => ({})),
}));
vi.mock("@/server/security/request-origin", () => ({
  isTrustedMutationRequest: vi.fn(),
}));
vi.mock("@/server/security/session-csrf", () => ({
  CSRF_DIGEST_COOKIE: "go-csrf-digest",
  CSRF_TOKEN_COOKIE: "go-csrf",
  hasValidSessionCsrfRequest: vi.fn(),
  hasValidSessionCsrfToken: vi.fn(),
  readSessionCsrfToken: vi.fn(),
}));

import { getAuthServerEnvironment } from "@/lib/env/auth-server";
import { getRuntimeEnvironment } from "@/lib/env/runtime";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { completeTemporaryPasscodeChange } from "@/server/auth/complete-temporary-passcode-change";
import { authorizeCurrentSession } from "@/server/auth/current-session";
import { isTrustedMutationRequest } from "@/server/security/request-origin";
import { hasValidSessionCsrfRequest } from "@/server/security/session-csrf";
import {
  hasValidSessionCsrfToken,
  readSessionCsrfToken,
} from "@/server/security/session-csrf";

import { POST } from "./route";

const origin = "https://guided-operations.example.test";
const client = { auth: {} };
const session = {
  allowed: true as const,
  account: {
    authUserId: "aaaaaaaa-0000-4000-8000-000000000001",
    mustChangePasscode: true,
  },
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

describe("POST /api/auth/complete-temporary-passcode-change", () => {
  beforeEach(() => vi.clearAllMocks());

  it("allows only a forced-change session with exact origin and CSRF proof", async () => {
    mockEnvironment();
    vi.mocked(authorizeCurrentSession).mockResolvedValue(session as never);
    vi.mocked(isTrustedMutationRequest).mockReturnValue(true);
    vi.mocked(hasValidSessionCsrfRequest).mockReturnValue(true);
    vi.mocked(completeTemporaryPasscodeChange).mockResolvedValue({
      status: "completed",
    });

    const response = await POST(
      new Request(`${origin}/api/auth/complete-temporary-passcode-change`, {
        method: "POST",
        body: JSON.stringify({
          employeeNumber: "EMP-42",
          passcode: "Cedar7!9",
        }),
      }),
    );

    expect(authorizeCurrentSession).toHaveBeenCalledWith(client, {
      allowForcedPasscodeChange: true,
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain("go-csrf=;");
    await expect(response.json()).resolves.toEqual({
      data: { status: "passcode_changed" },
    });
  });

  it("does not invoke the completion service when current authorization is absent", async () => {
    mockEnvironment();
    vi.mocked(authorizeCurrentSession).mockResolvedValue({
      allowed: false,
      reason: "session_revoked",
    });

    const response = await POST(
      new Request(`${origin}/api/auth/complete-temporary-passcode-change`, {
        method: "POST",
      }),
    );

    expect(response.status).toBe(401);
    expect(completeTemporaryPasscodeChange).not.toHaveBeenCalled();
  });

  it("rejects a cross-origin or missing-CSRF mutation before completion", async () => {
    mockEnvironment();
    vi.mocked(authorizeCurrentSession).mockResolvedValue(session as never);
    vi.mocked(isTrustedMutationRequest).mockReturnValue(false);

    const response = await POST(
      new Request(`${origin}/api/auth/complete-temporary-passcode-change`, {
        method: "POST",
      }),
    );

    expect(response.status).toBe(403);
    expect(completeTemporaryPasscodeChange).not.toHaveBeenCalled();
  });

  it("accepts the session-bound browser token for a native same-origin form fallback", async () => {
    mockEnvironment();
    vi.mocked(authorizeCurrentSession).mockResolvedValue(session as never);
    vi.mocked(isTrustedMutationRequest).mockReturnValue(true);
    vi.mocked(readSessionCsrfToken).mockReturnValue("browser-token");
    vi.mocked(hasValidSessionCsrfToken).mockReturnValue(true);
    vi.mocked(completeTemporaryPasscodeChange).mockResolvedValue({
      status: "completed",
    });

    const response = await POST(
      new Request(`${origin}/api/auth/complete-temporary-passcode-change`, {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          origin,
          cookie: "go-csrf=browser-token; go-csrf-digest=private-digest",
        },
        body: new URLSearchParams({
          employeeNumber: "EMP-42",
          passcode: "Cedar7!9",
          csrfToken: "",
        }),
      }),
    );

    expect(readSessionCsrfToken).toHaveBeenCalled();
    expect(hasValidSessionCsrfToken).toHaveBeenCalledWith(
      "browser-token",
      expect.any(Headers),
      session.sessionId,
      "k".repeat(32),
    );
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(`${origin}/login`);
  });
});
