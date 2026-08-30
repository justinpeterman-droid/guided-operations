import { beforeEach, describe, expect, it, vi } from "vitest";

const { createClient } = vi.hoisted(() => ({ createClient: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("@supabase/supabase-js", () => ({ createClient }));

import { SUPABASE_SESSION_STORAGE_KEY } from "@/server/auth/encrypted-supabase-session-storage";

import { createSupabaseSessionClient } from "./session-client";

describe("createSupabaseSessionClient", () => {
  beforeEach(() => vi.clearAllMocks());

  it("uses only the encrypted server storage for persistent Auth state", () => {
    const storage = {
      isServer: true as const,
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    };
    const expected = { auth: {} };
    createClient.mockReturnValue(expected);

    expect(
      createSupabaseSessionClient(
        "https://project.example.test",
        "publishable-key",
        storage,
      ),
    ).toBe(expected);
    expect(createClient).toHaveBeenCalledWith(
      "https://project.example.test",
      "publishable-key",
      {
        db: { schema: "api" },
        auth: {
          storageKey: SUPABASE_SESSION_STORAGE_KEY,
          storage,
          autoRefreshToken: false,
          persistSession: true,
          detectSessionInUrl: false,
          flowType: "pkce",
          skipAutoInitialize: true,
        },
      },
    );
  });
});
