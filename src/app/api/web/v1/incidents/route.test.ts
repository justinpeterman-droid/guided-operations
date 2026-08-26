import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env/auth-server", () => ({
  getAuthServerEnvironment: vi.fn(),
}));
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
vi.mock("@/server/incidents/create-incident-endpoint", () => ({
  validateCreateIncidentEndpointRequest: vi.fn(),
}));
vi.mock("@/server/incidents/create-incident", () => ({
  createIncidentForAuthorizedSession: vi.fn(),
}));
vi.mock("@/server/incidents/list-incidents", () => ({
  listIncidentsForCurrentSession: vi.fn(),
}));

import { getAuthServerEnvironment } from "@/lib/env/auth-server";
import { getIncidentServerEnvironment } from "@/lib/env/incident-server";
import { getRuntimeEnvironment } from "@/lib/env/runtime";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { authorizeCurrentSession } from "@/server/auth/current-session";
import { validateCreateIncidentEndpointRequest } from "@/server/incidents/create-incident-endpoint";
import { createIncidentForAuthorizedSession } from "@/server/incidents/create-incident";
import { listIncidentsForCurrentSession } from "@/server/incidents/list-incidents";

import { GET, POST } from "./route";

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
const command = {
  idempotencyKey: "a".repeat(16),
  revision: {
    schemaVersion: 1 as const,
    incidentName: "Fictional training scenario",
    incidentNumber: "F-INC-101",
    occurredAt: "2026-08-26T12:00:00Z",
    category: "training",
    fieldNotes: [],
    reviewedFacts: [],
  },
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
  vi.mocked(getRuntimeEnvironment).mockReturnValue({
    APP_ENV: "preview",
    APP_ORIGIN: "https://guided-operations.example.test",
  });
  vi.mocked(getIncidentServerEnvironment).mockReturnValue({
    INCIDENT_IDEMPOTENCY_HMAC_KEY: "i".repeat(32),
  });
  vi.mocked(createSupabaseServerClient).mockResolvedValue(client as never);
}

describe("POST /api/web/v1/incidents", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns only an opaque incident id after every protected layer succeeds", async () => {
    mockEnvironment();
    vi.mocked(authorizeCurrentSession).mockResolvedValue(session);
    vi.mocked(validateCreateIncidentEndpointRequest).mockResolvedValue({
      ok: true,
      command,
    });
    vi.mocked(createIncidentForAuthorizedSession).mockResolvedValue({
      kind: "created",
      incidentId: "44444444-4444-4444-8444-444444444444",
    });

    const response = await POST(new Request("https://example.test"));

    expect(response.status).toBe(201);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    await expect(response.json()).resolves.toMatchObject({
      data: { incidentId: "44444444-4444-4444-8444-444444444444" },
      meta: { api_version: "web-v1", request_id: expect.any(String) },
    });
    expect(createIncidentForAuthorizedSession).toHaveBeenCalledWith(
      command,
      session,
      client,
      "i".repeat(32),
    );
  });

  it("stops before request parsing or persistence when no current session exists", async () => {
    mockEnvironment();
    vi.mocked(authorizeCurrentSession).mockResolvedValue({
      allowed: false,
      reason: "missing_account",
    });

    const response = await POST(new Request("https://example.test"));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "authentication_required" },
    });
    expect(validateCreateIncidentEndpointRequest).not.toHaveBeenCalled();
    expect(createIncidentForAuthorizedSession).not.toHaveBeenCalled();
  });

  it("returns a current-account incident list with no facility or narrative data", async () => {
    vi.mocked(createSupabaseServerClient).mockResolvedValue(client as never);
    vi.mocked(listIncidentsForCurrentSession).mockResolvedValue({
      kind: "listed",
      incidents: [
        {
          incidentId: "44444444-4444-4444-8444-444444444444",
          incidentNumber: "F-LIST-001",
          displayName: "Fictional training scenario",
          status: "draft",
          occurredAt: "2026-08-26T12:00:00Z",
          category: "training",
          currentRevisionNumber: 1,
          updatedAt: "2026-08-26T12:00:00Z",
        },
      ],
    });

    const response = await GET(new Request("https://example.test?limit=25"));

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    await expect(response.json()).resolves.toMatchObject({
      data: { incidents: [{ incidentNumber: "F-LIST-001" }] },
      meta: { api_version: "web-v1", request_id: expect.any(String) },
    });
    expect(listIncidentsForCurrentSession).toHaveBeenCalledWith(client, 25);
  });

  it("rejects an unbounded list size before opening a database client", async () => {
    const response = await GET(new Request("https://example.test?limit=101"));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "invalid_request" },
    });
    expect(createSupabaseServerClient).not.toHaveBeenCalled();
  });
});
