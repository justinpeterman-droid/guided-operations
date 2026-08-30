import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/server/health/application-environment-readiness", () => ({
  assertApplicationEnvironmentReadiness: vi.fn(),
}));
vi.mock("@/server/health/supabase-readiness", () => ({
  hasSupabaseReadiness: vi.fn(),
}));
vi.mock("@/server/observability/safe-operational-event", () => ({
  writeSafeOperationalEvent: vi.fn(),
}));

import { assertApplicationEnvironmentReadiness } from "@/server/health/application-environment-readiness";
import { hasSupabaseReadiness } from "@/server/health/supabase-readiness";
import { writeSafeOperationalEvent } from "@/server/observability/safe-operational-event";

import { GET } from "./route";

const assertEnvironment = vi.mocked(assertApplicationEnvironmentReadiness);
const checkSupabase = vi.mocked(hasSupabaseReadiness);
const writeEvent = vi.mocked(writeSafeOperationalEvent);

describe("GET /api/health/ready", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    assertEnvironment.mockReturnValue({
      publicSupabase: {
        NEXT_PUBLIC_SUPABASE_URL: "https://fictional-project.supabase.co",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "fictional-publishable-key",
      },
      runtime: {
        APP_ENV: "test",
        APP_ORIGIN: "http://localhost:3000",
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
    expect(response.headers.get("x-request-id")).toMatch(/^[0-9a-f-]{36}$/);
    expect(writeEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        event_name: "health.readiness",
        outcome: "completed",
        status_code: 200,
        environment: "test",
      }),
    );
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
    expect(response.headers.get("x-request-id")).toBeNull();
    expect(writeEvent).not.toHaveBeenCalled();
  });

  it("returns only not_ready when the Supabase probe fails", async () => {
    checkSupabase.mockResolvedValue(false);

    const response = await GET();

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      service: "guided-operations-web",
      status: "not_ready",
    });
    expect(response.headers.get("x-request-id")).toMatch(/^[0-9a-f-]{36}$/);
    expect(writeEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        event_name: "health.readiness",
        outcome: "service_unavailable",
        status_code: 503,
        environment: "test",
      }),
    );
  });

  it("keeps provider errors and connection values out of the readiness event", async () => {
    checkSupabase.mockRejectedValue(
      new Error(
        "fictional connection failure at https://fictional-project.supabase.co",
      ),
    );

    const response = await GET();
    const serializedEvents = JSON.stringify(writeEvent.mock.calls);

    expect(response.status).toBe(503);
    expect(serializedEvents).not.toContain("fictional-project");
    expect(serializedEvents).not.toContain("fictional-publishable-key");
    expect(serializedEvents).not.toContain("connection failure");
  });
});
