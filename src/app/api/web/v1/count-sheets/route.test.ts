import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env/auth-server", () => ({ getAuthServerEnvironment: vi.fn() }));
vi.mock("@/lib/env/incident-server", () => ({
  getIncidentServerEnvironment: vi.fn(),
}));
vi.mock("@/lib/env/runtime", () => ({ getRuntimeEnvironment: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(),
}));
vi.mock("@/server/auth/current-session", () => ({
  authorizeCurrentSession: vi.fn(),
}));
vi.mock("@/server/paperwork/save-count-sheet-endpoint", () => ({
  validateCountSheetSaveRequest: vi.fn(),
}));
vi.mock("@/server/paperwork/save-count-sheet", () => ({
  saveCountSheetForCurrentSession: vi.fn(),
}));

import { getAuthServerEnvironment } from "@/lib/env/auth-server";
import { getIncidentServerEnvironment } from "@/lib/env/incident-server";
import { getRuntimeEnvironment } from "@/lib/env/runtime";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { authorizeCurrentSession } from "@/server/auth/current-session";
import { saveCountSheetForCurrentSession } from "@/server/paperwork/save-count-sheet";
import { validateCountSheetSaveRequest } from "@/server/paperwork/save-count-sheet-endpoint";

import { POST } from "./route";

const client = {};
const session = {
  allowed: true as const,
  account: {},
  sessionId: "33333333-3333-4333-8333-333333333333",
};
const command = {
  workDate: "2026-08-26",
  baseRevisionNumber: 0,
  structure: {},
  payload: {},
  reason: "Fictional initial count.",
  idempotencyKey: "fictional-count-sheet-retry-key-1234",
};

function mockEnvironment() {
  vi.mocked(getAuthServerEnvironment).mockReturnValue({
    SUPABASE_SECRET_KEY: "unused",
    SUPABASE_DB_URL: "https://db.example.test",
    EMPLOYEE_LOOKUP_PEPPER: "p".repeat(32),
    AUTH_DUMMY_ALIAS: "dummy@example.test",
    CSRF_HMAC_KEY: "k".repeat(32),
    AUTH_SIGN_IN_ENABLED: false,
  });
  vi.mocked(getIncidentServerEnvironment).mockReturnValue({
    INCIDENT_IDEMPOTENCY_HMAC_KEY: "i".repeat(32),
  });
  vi.mocked(getRuntimeEnvironment).mockReturnValue({
    APP_ENV: "preview",
    APP_ORIGIN: "https://guided-operations.example.test",
  });
  vi.mocked(createSupabaseServerClient).mockResolvedValue(client as never);
}

describe("POST /api/web/v1/count-sheets", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns only opaque record and revision identifiers after a protected save", async () => {
    mockEnvironment();
    vi.mocked(authorizeCurrentSession).mockResolvedValue(session as never);
    vi.mocked(validateCountSheetSaveRequest).mockResolvedValue({
      ok: true,
      ...command,
    });
    vi.mocked(saveCountSheetForCurrentSession).mockResolvedValue({
      kind: "saved",
      recordId: "44444444-4444-4444-8444-444444444444",
      revisionNumber: 1,
    });

    const response = await POST(new Request("https://example.test"));

    expect(response.status).toBe(201);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    await expect(response.json()).resolves.toMatchObject({
      data: {
        recordId: "44444444-4444-4444-8444-444444444444",
        revisionNumber: 1,
      },
      meta: { api_version: "web-v1", request_id: expect.any(String) },
    });
  });

  it("does not parse or save when the current session is denied", async () => {
    mockEnvironment();
    vi.mocked(authorizeCurrentSession).mockResolvedValue({
      allowed: false,
      reason: "missing_account",
    });

    const response = await POST(new Request("https://example.test"));

    expect(response.status).toBe(401);
    expect(validateCountSheetSaveRequest).not.toHaveBeenCalled();
    expect(saveCountSheetForCurrentSession).not.toHaveBeenCalled();
  });

  it("returns a conflict without masking a stale Count Sheet as an outage", async () => {
    mockEnvironment();
    vi.mocked(authorizeCurrentSession).mockResolvedValue(session as never);
    vi.mocked(validateCountSheetSaveRequest).mockResolvedValue({
      ok: true,
      ...command,
    });
    vi.mocked(saveCountSheetForCurrentSession).mockResolvedValue({
      kind: "conflict",
    });

    const response = await POST(new Request("https://example.test"));

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "revision_conflict" },
    });
  });
});
