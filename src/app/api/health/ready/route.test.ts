import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/server/health/application-environment-readiness", () => ({
  assertApplicationEnvironmentReadiness: vi.fn(),
}));
vi.mock("@/server/health/supabase-readiness", () => ({
  hasSupabaseReadiness: vi.fn(),
}));

import { assertApplicationEnvironmentReadiness } from "@/server/health/application-environment-readiness";
import { hasSupabaseReadiness } from "@/server/health/supabase-readiness";

import { GET } from "./route";

const assertEnvironment = vi.mocked(assertApplicationEnvironmentReadiness);
const checkSupabase = vi.mocked(hasSupabaseReadiness);

describe("GET /api/health/ready", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    assertEnvironment.mockReturnValue({
      publicSupabase: {
        NEXT_PUBLIC_SUPABASE_URL: "https://fictional-project.supabase.co",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "fictional-publishable-key",
      },
    });
  });

  it("returns only a bounded ready result when configuration and Supabase pass", async () => {
    checkSupabase.mockResolvedValue(true);

    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      service: "guided-operations-web",
      status: "ready",
    });
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("returns only not_ready when a required variable is invalid", async () => {
    assertEnvironment.mockImplementation(() => {
      throw new Error("OPENAI_API_KEY is missing");
    });

    const response = await GET();
    const body = await response.text();

    expect(response.status).toBe(503);
    expect(JSON.parse(body)).toEqual({
      service: "guided-operations-web",
      status: "not_ready",
    });
    expect(body).not.toContain("OPENAI_API_KEY");
    expect(checkSupabase).not.toHaveBeenCalled();
  });

  it("returns only not_ready when the Supabase probe fails", async () => {
    checkSupabase.mockResolvedValue(false);

    const response = await GET();

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      service: "guided-operations-web",
      status: "not_ready",
    });
  });
});
