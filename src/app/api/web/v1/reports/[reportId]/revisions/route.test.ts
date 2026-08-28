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
vi.mock("@/server/incidents/report-revision-endpoint", () => ({
  validateReportRevisionRequest: vi.fn(),
}));
vi.mock("@/server/incidents/append-report-revision", () => ({
  appendReportRevisionForCurrentSession: vi.fn(),
}));

import { getAuthServerEnvironment } from "@/lib/env/auth-server";
import { getIncidentServerEnvironment } from "@/lib/env/incident-server";
import { getRuntimeEnvironment } from "@/lib/env/runtime";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { authorizeCurrentSession } from "@/server/auth/current-session";
import { appendReportRevisionForCurrentSession } from "@/server/incidents/append-report-revision";
import { validateReportRevisionRequest } from "@/server/incidents/report-revision-endpoint";

import { POST } from "./route";

const client = {};
const reportId = "44444444-4444-4444-8444-444444444444";

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

describe("POST /api/web/v1/reports/[reportId]/revisions", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the newly appended revision number", async () => {
    mockEnvironment();
    vi.mocked(authorizeCurrentSession).mockResolvedValue({
      allowed: true,
      account: {},
      sessionId: "33333333-3333-4333-8333-333333333333",
    } as never);
    vi.mocked(validateReportRevisionRequest).mockResolvedValue({
      ok: true,
      baseRevisionNumber: 1,
      narrative: "Fictional corrected narrative.",
      reason: "Fictional correction.",
      idempotencyKey: "fictional-revision-retry-key-1234",
    });
    vi.mocked(appendReportRevisionForCurrentSession).mockResolvedValue({
      kind: "revised",
      revisionNumber: 2,
    });

    const response = await POST(new Request("https://example.test"), {
      params: Promise.resolve({ reportId }),
    });

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      data: { revisionNumber: 2 },
      meta: { api_version: "web-v1", request_id: expect.any(String) },
    });
    expect(appendReportRevisionForCurrentSession).toHaveBeenCalledWith(
      {
        reportId,
        baseRevisionNumber: 1,
        narrative: "Fictional corrected narrative.",
        reason: "Fictional correction.",
        idempotencyKey: "fictional-revision-retry-key-1234",
      },
      client,
      "i".repeat(32),
    );
  });

  it("reports a stale revision instead of masking it as an outage", async () => {
    mockEnvironment();
    vi.mocked(authorizeCurrentSession).mockResolvedValue({
      allowed: true,
      account: {},
      sessionId: "33333333-3333-4333-8333-333333333333",
    } as never);
    vi.mocked(validateReportRevisionRequest).mockResolvedValue({
      ok: true,
      baseRevisionNumber: 1,
      narrative: "Fictional corrected narrative.",
      reason: "Fictional correction.",
      idempotencyKey: "fictional-revision-retry-key-1234",
    });
    vi.mocked(appendReportRevisionForCurrentSession).mockResolvedValue({
      kind: "conflict",
    });

    const response = await POST(new Request("https://example.test"), {
      params: Promise.resolve({ reportId }),
    });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "revision_conflict" },
    });
  });

  it("returns a bounded denial when database report access is absent", async () => {
    mockEnvironment();
    vi.mocked(authorizeCurrentSession).mockResolvedValue({
      allowed: true,
      account: {},
      sessionId: "33333333-3333-4333-8333-333333333333",
    } as never);
    vi.mocked(validateReportRevisionRequest).mockResolvedValue({
      ok: true,
      baseRevisionNumber: 2,
      narrative: "Fictional denied correction.",
      reason: "Fictional denied reason.",
      idempotencyKey: "fictional-denied-retry-key-1234",
    });
    vi.mocked(appendReportRevisionForCurrentSession).mockResolvedValue({
      kind: "denied",
    });

    const response = await POST(new Request("https://example.test"), {
      params: Promise.resolve({ reportId }),
    });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "request_not_allowed" },
    });
  });
});
