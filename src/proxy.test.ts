import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/proxy", () => ({
  refreshSupabaseSession: vi.fn(),
}));

import { NextRequest, NextResponse } from "next/server";

import { refreshSupabaseSession } from "@/lib/supabase/proxy";

import { proxy } from "./proxy";

describe("proxy", () => {
  it.each(["/", "/login", "/preview/workspace", "/api/health/live"])(
    "does not initialize Supabase session refresh for public review route %s",
    async (pathname) => {
      const response = await proxy(
        new NextRequest(`https://guided-operations.example.test${pathname}`),
      );

      expect(response.status).toBe(200);
      expect(refreshSupabaseSession).not.toHaveBeenCalled();
    },
  );

  it("refreshes sessions before every protected application route", async () => {
    const expected = NextResponse.next();
    vi.mocked(refreshSupabaseSession).mockResolvedValue(expected);
    const request = new NextRequest(
      "https://guided-operations.example.test/reports",
    );

    await expect(proxy(request)).resolves.toBe(expected);
    expect(refreshSupabaseSession).toHaveBeenCalledWith(request);
  });
});
