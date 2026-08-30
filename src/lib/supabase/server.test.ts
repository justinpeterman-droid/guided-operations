import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  cookieStore,
  cookies,
  createEncryptedSupabaseSessionStorage,
  createSupabaseSessionClient,
} = vi.hoisted(() => ({
  cookieStore: { getAll: vi.fn(), set: vi.fn() },
  cookies: vi.fn(),
  createEncryptedSupabaseSessionStorage: vi.fn(),
  createSupabaseSessionClient: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies }));
vi.mock("@/lib/env/auth-session", () => ({
  getAuthSessionEnvironment: vi.fn(),
}));
vi.mock("@/lib/env/runtime", () => ({
  getRuntimeEnvironment: vi.fn(),
}));
vi.mock("@/lib/env/supabase-public", () => ({
  getPublicSupabaseEnvironment: vi.fn(),
}));
vi.mock("@/server/auth/encrypted-supabase-session-storage", () => ({
  createEncryptedSupabaseSessionStorage,
}));
vi.mock("./session-client", () => ({ createSupabaseSessionClient }));

import { getAuthSessionEnvironment } from "@/lib/env/auth-session";
import { getRuntimeEnvironment } from "@/lib/env/runtime";
import { getPublicSupabaseEnvironment } from "@/lib/env/supabase-public";

import { createSupabaseServerClient } from "./server";

describe("createSupabaseServerClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cookies.mockResolvedValue(cookieStore);
    vi.mocked(getPublicSupabaseEnvironment).mockReturnValue({
      NEXT_PUBLIC_SUPABASE_URL: "https://project.example.test",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "publishable-key",
    });
    vi.mocked(getAuthSessionEnvironment).mockReturnValue({
      AUTH_SESSION_ENCRYPTION_KEY:
        "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
    });
    vi.mocked(getRuntimeEnvironment).mockReturnValue({
      APP_ENV: "production",
      APP_ORIGIN: "https://guided-operations.example.test",
    });
  });

  it("connects the encrypted cookie adapter to the routine user client", async () => {
    const storage = {
      isServer: true as const,
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    };
    const client = { auth: {} };
    createEncryptedSupabaseSessionStorage.mockReturnValue(storage);
    createSupabaseSessionClient.mockReturnValue(client);

    await expect(createSupabaseServerClient()).resolves.toBe(client);
    expect(createEncryptedSupabaseSessionStorage).toHaveBeenCalledWith({
      encryptionKey: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
      secure: true,
      cookies: {
        readAll: expect.any(Function),
        writeAll: expect.any(Function),
      },
    });
    expect(createSupabaseSessionClient).toHaveBeenCalledWith(
      "https://project.example.test",
      "publishable-key",
      storage,
    );

    const cookieIo =
      createEncryptedSupabaseSessionStorage.mock.calls[0][0].cookies;
    cookieStore.getAll.mockReturnValue([{ name: "test", value: "opaque" }]);
    expect(cookieIo.readAll()).toEqual([{ name: "test", value: "opaque" }]);
    cookieIo.writeAll([
      {
        name: "go-auth-session",
        value: "ciphertext",
        options: {
          httpOnly: true,
          sameSite: "lax",
          secure: true,
          path: "/",
          maxAge: 60,
          priority: "high",
        },
      },
    ]);
    expect(cookieStore.set).toHaveBeenCalledWith(
      "go-auth-session",
      "ciphertext",
      expect.objectContaining({ httpOnly: true, secure: true }),
    );
  });
});
