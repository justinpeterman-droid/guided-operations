import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/env/auth-server", () => ({
  getAuthServerEnvironment: vi.fn(),
}));
vi.mock("@/lib/env/runtime", () => ({ getRuntimeEnvironment: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(),
}));
vi.mock("@/server/security/csrf-endpoint", () => ({
  issueCsrfForCurrentSession: vi.fn(),
}));

import { getAuthServerEnvironment } from "@/lib/env/auth-server";
import { getRuntimeEnvironment } from "@/lib/env/runtime";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { issueCsrfForCurrentSession } from "@/server/security/csrf-endpoint";

import { GET } from "./route";

const serverClient = {};

function mockAuthorizedEnvironment() {
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
    APP_ORIGIN: "https://guided-operations.example.test",
  });
  vi.mocked(createSupabaseServerClient).mockResolvedValue(
    serverClient as never,
  );
}

describe("GET /api/auth/csrf", () => {
  it("sets a fresh private digest for a current authorized session", async () => {
    mockAuthorizedEnvironment();
    vi.mocked(issueCsrfForCurrentSession).mockResolvedValue({
      kind: "issued",
      token: { token: "browser-token", digest: "session-bound-digest" },
    });

    const response = await GET();

    await expect(response.json()).resolves.toEqual({
      csrfToken: "browser-token",
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("set-cookie")).toContain(
      "go-csrf=browser-token",
    );
    expect(response.headers.get("set-cookie")).toContain(
      "go-csrf-digest=session-bound-digest",
    );
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
    expect(response.headers.get("set-cookie")).toContain("Secure");
    expect(response.headers.get("set-cookie")).toContain("SameSite=strict");
  });

  it("does not issue a browser token when current-session authorization denies", async () => {
    mockAuthorizedEnvironment();
    vi.mocked(issueCsrfForCurrentSession).mockResolvedValue({ kind: "denied" });

    const response = await GET();

    await expect(response.json()).resolves.toEqual({
      error: "authentication_required",
    });
    expect(response.status).toBe(401);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("returns a generic unavailable response if token issuance fails", async () => {
    mockAuthorizedEnvironment();
    vi.mocked(issueCsrfForCurrentSession).mockRejectedValue(new Error("nope"));

    const response = await GET();

    await expect(response.json()).resolves.toEqual({
      error: "service_unavailable",
    });
    expect(response.status).toBe(503);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });
});
