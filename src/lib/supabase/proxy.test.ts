import { beforeEach, describe, expect, it, vi } from "vitest";

const { createServerClient } = vi.hoisted(() => ({
  createServerClient: vi.fn(),
}));

vi.mock("@supabase/ssr", () => ({ createServerClient }));
vi.mock("@/lib/env/supabase-public", () => ({
  getPublicSupabaseEnvironment: vi.fn(),
}));

import { NextRequest } from "next/server";

import { getPublicSupabaseEnvironment } from "@/lib/env/supabase-public";

import { refreshSupabaseSession } from "./proxy";

describe("refreshSupabaseSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getPublicSupabaseEnvironment).mockReturnValue({
      NEXT_PUBLIC_SUPABASE_URL: "https://project.example.test",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "publishable-key",
    });
  });

  it("forwards request cookies to claims verification and returns refreshed cookies", async () => {
    let cookieAdapter:
      | {
          getAll: () => unknown[];
          setAll: (
            cookies: Array<{
              name: string;
              value: string;
              options: Record<string, unknown>;
            }>,
          ) => void;
        }
      | undefined;
    let incomingCookies: unknown[] = [];

    createServerClient.mockImplementation(
      (_url, _key, options: { cookies: typeof cookieAdapter }) => {
        cookieAdapter = options.cookies;
        return {
          auth: {
            getClaims: async () => {
              incomingCookies = cookieAdapter?.getAll() ?? [];
              cookieAdapter?.setAll([
                {
                  name: "sb-example-auth-token",
                  value: "refreshed-session",
                  options: {
                    httpOnly: true,
                    sameSite: "lax",
                    secure: true,
                    path: "/",
                  },
                },
              ]);
              return { data: { claims: {} }, error: null };
            },
          },
        };
      },
    );

    const request = new NextRequest(
      "https://guided-operations.example.test/reports",
      {
        headers: { cookie: "sb-example-auth-token=prior-session" },
      },
    );

    const response = await refreshSupabaseSession(request);

    expect(createServerClient).toHaveBeenCalledWith(
      "https://project.example.test",
      "publishable-key",
      expect.objectContaining({ cookies: expect.any(Object) }),
    );
    expect(incomingCookies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "sb-example-auth-token",
          value: "prior-session",
        }),
      ]),
    );
    expect(response.headers.get("set-cookie")).toContain(
      "sb-example-auth-token=refreshed-session",
    );
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
    expect(response.headers.get("set-cookie")).toContain("Secure");
    expect(response.headers.get("set-cookie")).toContain("SameSite=lax");
  });

  it("does not invent refreshed cookies when provider claims need no rotation", async () => {
    createServerClient.mockReturnValue({
      auth: { getClaims: vi.fn().mockResolvedValue({ data: { claims: {} } }) },
    });

    const response = await refreshSupabaseSession(
      new NextRequest("https://guided-operations.example.test/reports"),
    );

    expect(response.headers.get("set-cookie")).toBeNull();
  });
});
