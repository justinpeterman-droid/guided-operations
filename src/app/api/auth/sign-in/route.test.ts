import { beforeEach, describe, expect, it, vi } from "vitest";
import { cookies } from "next/headers";
import { NextRequest } from "next/server";

vi.mock("next/headers", () => ({ cookies: vi.fn() }));
vi.mock("@/lib/env/auth-server", () => ({ getAuthServerEnvironment: vi.fn() }));
vi.mock("@/lib/env/runtime", () => ({ getRuntimeEnvironment: vi.fn() }));
vi.mock("@/server/auth/guarded-employee-sign-in", () => ({
  signInWithEmployeeNumberGuarded: vi.fn(),
}));
vi.mock("@/server/auth/request-rate-limit-subjects", () => ({
  createAuthRequestRateLimitSubjects: vi.fn(),
}));
vi.mock("@/server/auth/sign-in-endpoint", () => ({
  authenticateValidatedSignInRequest: vi.fn(),
  disabledSignInEndpoint: vi.fn(),
  validateSignInEndpointRequest: vi.fn(),
}));
vi.mock("@/server/auth/server-employee-sign-in", () => ({
  createServerEmployeeSignInDependencies: vi.fn(),
}));
vi.mock("@/server/observability/safe-operational-event", () => ({
  writeSafeOperationalEvent: vi.fn(),
}));
vi.mock("@/server/auth/supabase-auth-adapters", () => ({
  createSupabasePasswordAuthenticatorForCookieIo: vi.fn(() => ({})),
}));

import { getAuthServerEnvironment } from "@/lib/env/auth-server";
import { getRuntimeEnvironment } from "@/lib/env/runtime";
import { createAuthRequestRateLimitSubjects } from "@/server/auth/request-rate-limit-subjects";
import {
  authenticateValidatedSignInRequest,
  disabledSignInEndpoint,
  validateSignInEndpointRequest,
} from "@/server/auth/sign-in-endpoint";
import { createServerEmployeeSignInDependencies } from "@/server/auth/server-employee-sign-in";
import { writeSafeOperationalEvent } from "@/server/observability/safe-operational-event";
import { createSupabasePasswordAuthenticatorForCookieIo } from "@/server/auth/supabase-auth-adapters";

import { POST } from "./route";

const origin = "https://guided-operations.example.test";
const input = { employeeNumber: "EMP-42", passcode: "FictionalPasscode1" };
const subjects = {
  deviceCookieValue: "d".repeat(43),
  deviceDigest: "a".repeat(64),
  networkDigest: "b".repeat(64),
  globalDigest: "c".repeat(64),
};

function mockEnvironment(enabled: boolean) {
  vi.mocked(getAuthServerEnvironment).mockReturnValue({
    SUPABASE_SECRET_KEY: "unused",
    SUPABASE_DB_URL: "https://db.example.test",
    EMPLOYEE_LOOKUP_PEPPER: "p".repeat(32),
    AUTH_DUMMY_ALIAS: "dummy@example.test",
    CSRF_HMAC_KEY: "k".repeat(32),
    AUTH_SIGN_IN_ENABLED: enabled,
  });
  vi.mocked(getRuntimeEnvironment).mockReturnValue({
    APP_ENV: "preview",
    APP_ORIGIN: origin,
  });
}

describe("POST /api/auth/sign-in", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(cookies).mockResolvedValue({ getAll: () => [] } as never);
  });

  it("fails closed before the private sign-in feature is enabled", async () => {
    mockEnvironment(false);
    const disabled = new Response(null, { status: 404 });
    vi.mocked(disabledSignInEndpoint).mockReturnValue({ response: disabled });

    const response = await POST(new NextRequest(`${origin}/api/auth/sign-in`));

    expect(response).toBe(disabled);
    expect(validateSignInEndpointRequest).not.toHaveBeenCalled();
    expect(writeSafeOperationalEvent).not.toHaveBeenCalled();
  });

  it("sets only the opaque, scoped device cookie after endpoint success", async () => {
    mockEnvironment(true);
    vi.mocked(validateSignInEndpointRequest).mockResolvedValue({
      ok: true,
      input,
    });
    vi.mocked(createAuthRequestRateLimitSubjects).mockReturnValue(subjects);
    vi.mocked(createServerEmployeeSignInDependencies).mockResolvedValue(
      {} as never,
    );
    vi.mocked(authenticateValidatedSignInRequest).mockResolvedValue({
      response: Response.json({ status: "signed_in" }),
      deviceCookieValue: subjects.deviceCookieValue,
    });

    const response = await POST(new NextRequest(`${origin}/api/auth/sign-in`));

    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain(
      `go-auth-device=${subjects.deviceCookieValue}`,
    );
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
    expect(response.headers.get("set-cookie")).toContain("Secure");
    expect(response.headers.get("set-cookie")).toContain("Path=/api/auth");
    expect(response.headers.get("set-cookie")).toContain("SameSite=lax");
    expect(authenticateValidatedSignInRequest).toHaveBeenCalledWith(
      input,
      subjects,
      expect.any(Function),
    );
    expect(createServerEmployeeSignInDependencies).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
    );
    expect(writeSafeOperationalEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        event_name: "auth.sign_in",
        outcome: "signed_in",
        status_code: 200,
      }),
    );
    const eventCalls = JSON.stringify(
      vi.mocked(writeSafeOperationalEvent).mock.calls,
    );
    expect(eventCalls).not.toContain(input.employeeNumber);
    expect(eventCalls).not.toContain(input.passcode);
  });

  it("redirects a native form fallback without credentials in the destination URL", async () => {
    mockEnvironment(true);
    vi.mocked(validateSignInEndpointRequest).mockResolvedValue({
      ok: true,
      input,
    });
    vi.mocked(createAuthRequestRateLimitSubjects).mockReturnValue(subjects);
    vi.mocked(createServerEmployeeSignInDependencies).mockResolvedValue(
      {} as never,
    );
    vi.mocked(authenticateValidatedSignInRequest).mockResolvedValue({
      response: Response.json({ status: "signed_in" }),
      deviceCookieValue: subjects.deviceCookieValue,
    });

    const response = await POST(
      new NextRequest(`${origin}/api/auth/sign-in`, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams(input),
      }),
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(`${origin}/home`);
    expect(response.headers.get("location")).not.toContain(input.passcode);
  });

  it("forwards only encrypted session cookies onto a successful redirect", async () => {
    mockEnvironment(true);
    vi.mocked(validateSignInEndpointRequest).mockResolvedValue({
      ok: true,
      input,
    });
    vi.mocked(createAuthRequestRateLimitSubjects).mockReturnValue(subjects);
    vi.mocked(createServerEmployeeSignInDependencies).mockResolvedValue(
      {} as never,
    );
    vi.mocked(authenticateValidatedSignInRequest).mockResolvedValue({
      response: Response.json({ status: "signed_in" }),
      deviceCookieValue: subjects.deviceCookieValue,
    });
    vi.mocked(cookies).mockResolvedValue({
      getAll: () => [
        { name: "go-auth-session", value: "opaque" },
        { name: "not-a-session", value: "ignore" },
      ],
    } as never);
    vi.mocked(
      createSupabasePasswordAuthenticatorForCookieIo,
    ).mockImplementation((cookieIo) => {
      cookieIo.writeAll([
        {
          name: "go-auth-session",
          value: "opaque",
          options: {
            httpOnly: true,
            sameSite: "lax",
            secure: false,
            path: "/",
            maxAge: 1,
            priority: "high",
          },
        },
      ]);
      return {} as never;
    });

    const response = await POST(new NextRequest(`${origin}/api/auth/sign-in`));

    expect(response.headers.get("set-cookie")).toContain(
      "go-auth-session=opaque",
    );
    expect(response.headers.get("set-cookie")).not.toContain(
      "not-a-session=ignore",
    );
  });

  it("records a generic failure without logging credentials or account existence", async () => {
    mockEnvironment(true);
    vi.mocked(validateSignInEndpointRequest).mockResolvedValue({
      ok: true,
      input,
    });
    vi.mocked(createAuthRequestRateLimitSubjects).mockReturnValue(subjects);
    vi.mocked(createServerEmployeeSignInDependencies).mockResolvedValue(
      {} as never,
    );
    vi.mocked(authenticateValidatedSignInRequest).mockResolvedValue({
      response: Response.json({ message: "Sign-in failed" }, { status: 401 }),
      deviceCookieValue: subjects.deviceCookieValue,
    });

    const response = await POST(new NextRequest(`${origin}/api/auth/sign-in`));

    expect(response.status).toBe(401);
    expect(writeSafeOperationalEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        event_name: "auth.sign_in",
        outcome: "sign_in_failed",
        status_code: 401,
      }),
    );
    const eventCalls = JSON.stringify(
      vi.mocked(writeSafeOperationalEvent).mock.calls,
    );
    expect(eventCalls).not.toContain(input.employeeNumber);
    expect(eventCalls).not.toContain(input.passcode);
  });
});
