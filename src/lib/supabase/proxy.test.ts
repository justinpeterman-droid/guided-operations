import { beforeEach, describe, expect, it, vi } from "vitest";

const { createSupabaseSessionClient } = vi.hoisted(() => ({
  createSupabaseSessionClient: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("./session-client", () => ({ createSupabaseSessionClient }));
vi.mock("@/lib/env/auth-session", () => ({
  getAuthSessionEnvironment: vi.fn(),
}));
vi.mock("@/lib/env/auth-server", () => ({
  getAuthServerEnvironment: vi.fn(),
}));
vi.mock("@/lib/env/runtime", () => ({
  getRuntimeEnvironment: vi.fn(),
}));
vi.mock("@/lib/env/supabase-public", () => ({
  getPublicSupabaseEnvironment: vi.fn(),
}));

import { NextRequest } from "next/server";

import { getAuthSessionEnvironment } from "@/lib/env/auth-session";
import { getAuthServerEnvironment } from "@/lib/env/auth-server";
import { getRuntimeEnvironment } from "@/lib/env/runtime";
import { getPublicSupabaseEnvironment } from "@/lib/env/supabase-public";
import {
  createEncryptedSupabaseSessionStorage,
  SUPABASE_SESSION_STORAGE_KEY,
  type EncryptedSupabaseSessionStorage,
} from "@/server/auth/encrypted-supabase-session-storage";
import {
  CSRF_DIGEST_COOKIE,
  CSRF_TOKEN_COOKIE,
  issueSessionCsrfToken,
} from "@/server/security/session-csrf";

import { refreshSupabaseSession } from "./proxy";

const encryptionKey = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
const session = JSON.stringify({
  access_token: "fictional-access-token",
  refresh_token: "fictional-refresh-token",
  user: { email: "fictional-hidden-alias@auth.invalid" },
});

function encryptedCookieHeader(value: string): Promise<string> {
  const cookies: Array<{ name: string; value: string }> = [];
  const storage = createEncryptedSupabaseSessionStorage({
    encryptionKey,
    secure: true,
    cookies: {
      readAll: () => cookies,
      writeAll: (changes) => {
        for (const change of changes) {
          if (change.options.maxAge !== 0) {
            cookies.push({ name: change.name, value: change.value });
          }
        }
      },
    },
  });
  return storage
    .setItem(SUPABASE_SESSION_STORAGE_KEY, value)
    .then(() =>
      cookies.map(({ name, value }) => `${name}=${value}`).join("; "),
    );
}

describe("refreshSupabaseSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getPublicSupabaseEnvironment).mockReturnValue({
      NEXT_PUBLIC_SUPABASE_URL: "https://project.example.test",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "publishable-key",
    });
    vi.mocked(getAuthSessionEnvironment).mockReturnValue({
      AUTH_SESSION_ENCRYPTION_KEY: encryptionKey,
    });
    vi.mocked(getAuthServerEnvironment).mockReturnValue({
      SUPABASE_SECRET_KEY: "unused",
      SUPABASE_DB_URL: "postgresql://unused.example.test/postgres",
      EMPLOYEE_LOOKUP_PEPPER: "p".repeat(32),
      AUTH_DUMMY_ALIAS: "fictional-dummy@auth.invalid",
      CSRF_HMAC_KEY: "k".repeat(32),
      AUTH_SIGN_IN_ENABLED: true,
    });
    vi.mocked(getRuntimeEnvironment).mockReturnValue({
      APP_ENV: "production",
      APP_ORIGIN: "https://guided-operations.example.test",
    });
  });

  it("decrypts the incoming session for claims verification and emits only opaque secure cookies", async () => {
    let incomingSession: string | null = null;
    createSupabaseSessionClient.mockImplementation(
      (_url, _key, storage: EncryptedSupabaseSessionStorage) => ({
        auth: {
          getClaims: async () => {
            incomingSession = await storage.getItem(
              SUPABASE_SESSION_STORAGE_KEY,
            );
            await storage.setItem(SUPABASE_SESSION_STORAGE_KEY, session);
            return { data: { claims: {} }, error: null };
          },
        },
      }),
    );
    const request = new NextRequest(
      "https://guided-operations.example.test/reports",
      { headers: { cookie: await encryptedCookieHeader(session) } },
    );

    const response = await refreshSupabaseSession(request);

    expect(incomingSession).toBe(session);
    expect(createSupabaseSessionClient).toHaveBeenCalledWith(
      "https://project.example.test",
      "publishable-key",
      expect.any(Object),
    );
    const setCookie = response.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain(`${SUPABASE_SESSION_STORAGE_KEY}=`);
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("Secure");
    expect(setCookie).toContain("SameSite=lax");
    expect(setCookie).toContain("Priority=high");
    expect(setCookie).not.toContain("fictional-hidden-alias");
    expect(setCookie).not.toContain("fictional-access-token");
    expect(setCookie).not.toContain("fictional-refresh-token");
    expect(response.headers.get("cache-control")).toBe(
      "private, no-store, max-age=0",
    );
    expect(response.headers.get("pragma")).toBe("no-cache");
    expect(response.headers.get("expires")).toBe("0");
  });

  it("does not invent cookies when claims verification needs no rotation", async () => {
    createSupabaseSessionClient.mockReturnValue({
      auth: { getClaims: vi.fn().mockResolvedValue({ data: {}, error: null }) },
    });

    const response = await refreshSupabaseSession(
      new NextRequest("https://guided-operations.example.test/reports"),
    );

    expect(response.headers.get("set-cookie")).toBeNull();
    expect(response.headers.get("cache-control")).toContain("no-store");
  });

  it("issues a session-bound CSRF pair only when an authorized account page is requested", async () => {
    createSupabaseSessionClient.mockReturnValue({
      auth: {
        getClaims: vi.fn().mockResolvedValue({
          data: {
            claims: {
              sub: "11111111-1111-4111-8111-111111111111",
              session_id: "22222222-2222-4222-8222-222222222222",
              app_metadata: { auth_version: 1 },
            },
          },
          error: null,
        }),
      },
    });

    const response = await refreshSupabaseSession(
      new NextRequest("https://guided-operations.example.test/account"),
    );

    const setCookies = response.headers.getSetCookie();
    const browserToken = setCookies.find((cookie) =>
      cookie.startsWith("go-csrf="),
    );
    const privateDigest = setCookies.find((cookie) =>
      cookie.startsWith("go-csrf-digest="),
    );
    expect(browserToken).toContain("SameSite=strict");
    expect(browserToken).toContain("Secure");
    expect(browserToken).not.toContain("HttpOnly");
    expect(privateDigest).toContain("HttpOnly");
    expect(privateDigest).toContain("SameSite=strict");
    expect(privateDigest).toContain("Secure");
  });

  it("retains an existing valid account-page CSRF pair", async () => {
    const sessionId = "22222222-2222-4222-8222-222222222222";
    const hmacKey = "k".repeat(32);
    const existing = issueSessionCsrfToken(sessionId, hmacKey);
    createSupabaseSessionClient.mockReturnValue({
      auth: {
        getClaims: vi.fn().mockResolvedValue({
          data: {
            claims: {
              sub: "11111111-1111-4111-8111-111111111111",
              session_id: sessionId,
              app_metadata: { auth_version: 1 },
            },
          },
          error: null,
        }),
      },
    });

    const response = await refreshSupabaseSession(
      new NextRequest("https://guided-operations.example.test/account", {
        headers: {
          cookie: `${CSRF_TOKEN_COOKIE}=${existing.token}; ${CSRF_DIGEST_COOKIE}=${existing.digest}`,
        },
      }),
    );

    expect(response.headers.getSetCookie()).toEqual([]);
  });

  it("replaces an account-page CSRF pair bound to another session", async () => {
    const sessionId = "22222222-2222-4222-8222-222222222222";
    const hmacKey = "k".repeat(32);
    const stale = issueSessionCsrfToken(
      "33333333-3333-4333-8333-333333333333",
      hmacKey,
    );
    createSupabaseSessionClient.mockReturnValue({
      auth: {
        getClaims: vi.fn().mockResolvedValue({
          data: {
            claims: {
              sub: "11111111-1111-4111-8111-111111111111",
              session_id: sessionId,
              app_metadata: { auth_version: 1 },
            },
          },
          error: null,
        }),
      },
    });

    const response = await refreshSupabaseSession(
      new NextRequest("https://guided-operations.example.test/account", {
        headers: {
          cookie: `${CSRF_TOKEN_COOKIE}=${stale.token}; ${CSRF_DIGEST_COOKIE}=${stale.digest}`,
        },
      }),
    );

    const setCookies = response.headers.getSetCookie();
    expect(setCookies).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^go-csrf=/),
        expect.stringMatching(/^go-csrf-digest=/),
      ]),
    );
    expect(setCookies.join(";")).not.toContain(stale.token);
    expect(setCookies.join(";")).not.toContain(stale.digest);
  });

  it("expires a malformed encrypted session without disclosing its value", async () => {
    createSupabaseSessionClient.mockImplementation(
      (_url, _key, storage: EncryptedSupabaseSessionStorage) => ({
        auth: {
          getClaims: async () => {
            await storage.getItem(SUPABASE_SESSION_STORAGE_KEY);
            return { data: {}, error: null };
          },
        },
      }),
    );
    const response = await refreshSupabaseSession(
      new NextRequest("https://guided-operations.example.test/reports", {
        headers: {
          cookie: `${SUPABASE_SESSION_STORAGE_KEY}=v1.invalid.invalid.invalid`,
        },
      }),
    );

    const setCookie = response.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain(`${SUPABASE_SESSION_STORAGE_KEY}=`);
    expect(setCookie).toContain("Max-Age=0");
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).not.toContain("v1.invalid.invalid.invalid");
  });
});
