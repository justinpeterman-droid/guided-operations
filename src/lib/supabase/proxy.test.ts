import { beforeEach, describe, expect, it, vi } from "vitest";

const { createSupabaseSessionClient } = vi.hoisted(() => ({
  createSupabaseSessionClient: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("./session-client", () => ({ createSupabaseSessionClient }));
vi.mock("@/lib/env/auth-session", () => ({
  getAuthSessionEnvironment: vi.fn(),
}));
vi.mock("@/lib/env/runtime", () => ({
  getRuntimeEnvironment: vi.fn(),
}));
vi.mock("@/lib/env/supabase-public", () => ({
  getPublicSupabaseEnvironment: vi.fn(),
}));

import { NextRequest } from "next/server";

import { getAuthSessionEnvironment } from "@/lib/env/auth-session";
import { getRuntimeEnvironment } from "@/lib/env/runtime";
import { getPublicSupabaseEnvironment } from "@/lib/env/supabase-public";
import {
  createEncryptedSupabaseSessionStorage,
  SUPABASE_SESSION_STORAGE_KEY,
  type EncryptedSupabaseSessionStorage,
} from "@/server/auth/encrypted-supabase-session-storage";

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
