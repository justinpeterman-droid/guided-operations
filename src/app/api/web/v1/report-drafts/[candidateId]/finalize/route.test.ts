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
vi.mock("@/server/incidents/report-finalization-endpoint", () => ({
  validateReportFinalizationEndpointRequest: vi.fn(),
}));
vi.mock("@/server/incidents/finalize-report-draft", () => ({
  finalizeReportDraftForCurrentSession: vi.fn(),
}));

import { getAuthServerEnvironment } from "@/lib/env/auth-server";
import { getIncidentServerEnvironment } from "@/lib/env/incident-server";
import { getRuntimeEnvironment } from "@/lib/env/runtime";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { authorizeCurrentSession } from "@/server/auth/current-session";
import { finalizeReportDraftForCurrentSession } from "@/server/incidents/finalize-report-draft";
import { validateReportFinalizationEndpointRequest } from "@/server/incidents/report-finalization-endpoint";

import { POST } from "./route";

const client = {};
const session = {
  allowed: true as const,
  account: {
    authUserId: "11111111-1111-4111-8111-111111111111",
    facilityId: "22222222-2222-4222-8222-222222222222",
    shiftCode: null,
    role: "officer" as const,
    status: "active" as const,
    authVersion: 1,
    mustChangePasscode: false,
  },
  sessionId: "33333333-3333-4333-8333-333333333333",
};
const candidateId = "44444444-4444-4444-8444-444444444444";

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

describe("POST /api/web/v1/report-drafts/[candidateId]/finalize", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns only an opaque report id after human finalization succeeds", async () => {
    mockEnvironment();
    vi.mocked(authorizeCurrentSession).mockResolvedValue(session);
    vi.mocked(validateReportFinalizationEndpointRequest).mockResolvedValue({
      ok: true,
      narrative: "Fictional human-reviewed final narrative.",
      reviewedByOfficer: true,
      idempotencyKey: "fictional-finalize-retry-key-1234",
    });
    vi.mocked(finalizeReportDraftForCurrentSession).mockResolvedValue({
      kind: "finalized",
      reportId: "55555555-5555-4555-8555-555555555555",
    });

    const response = await POST(new Request("https://example.test"), {
      params: Promise.resolve({ candidateId }),
    });

    expect(response.status).toBe(201);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    await expect(response.json()).resolves.toMatchObject({
      data: { reportId: "55555555-5555-4555-8555-555555555555" },
      meta: { api_version: "web-v1", request_id: expect.any(String) },
    });
    expect(finalizeReportDraftForCurrentSession).toHaveBeenCalledWith(
      {
        candidateId,
        narrative: "Fictional human-reviewed final narrative.",
        reviewedByOfficer: true,
        idempotencyKey: "fictional-finalize-retry-key-1234",
      },
      client,
      "i".repeat(32),
    );
  });

  it("stops before request validation or finalization when no current session exists", async () => {
    mockEnvironment();
    vi.mocked(authorizeCurrentSession).mockResolvedValue({
      allowed: false,
      reason: "missing_account",
    });

    const response = await POST(new Request("https://example.test"), {
      params: Promise.resolve({ candidateId }),
    });

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "authentication_required" },
    });
    expect(validateReportFinalizationEndpointRequest).not.toHaveBeenCalled();
    expect(finalizeReportDraftForCurrentSession).not.toHaveBeenCalled();
  });

  it("returns a non-retryable forbidden response for a database authorization denial", async () => {
    mockEnvironment();
    vi.mocked(authorizeCurrentSession).mockResolvedValue(session);
    vi.mocked(validateReportFinalizationEndpointRequest).mockResolvedValue({
      ok: true,
      narrative: "Fictional human-reviewed final narrative.",
      reviewedByOfficer: true,
      idempotencyKey: "fictional-finalize-retry-key-1234",
    });
    vi.mocked(finalizeReportDraftForCurrentSession).mockResolvedValue({
      kind: "denied",
    });

    const response = await POST(new Request("https://example.test"), {
      params: Promise.resolve({ candidateId }),
    });

    expect(response.status).toBe(403);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "request_not_allowed" },
    });
  });

  it("returns a conflict when the incident changed after draft generation", async () => {
    mockEnvironment();
    vi.mocked(authorizeCurrentSession).mockResolvedValue(session);
    vi.mocked(validateReportFinalizationEndpointRequest).mockResolvedValue({
      ok: true,
      narrative: "Fictional human-reviewed final narrative.",
      reviewedByOfficer: true,
      idempotencyKey: "fictional-finalize-retry-key-1234",
    });
    vi.mocked(finalizeReportDraftForCurrentSession).mockResolvedValue({
      kind: "conflict",
    });

    const response = await POST(new Request("https://example.test"), {
      params: Promise.resolve({ candidateId }),
    });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "revision_conflict" },
    });
  });
});
