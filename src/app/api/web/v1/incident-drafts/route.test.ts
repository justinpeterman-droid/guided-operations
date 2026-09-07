import { beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
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
vi.mock("@/server/incidents/incident-drafts", () => ({
  listIncidentDraftsForCurrentSession: vi.fn(),
  saveIncidentDraftForAuthorizedSession: vi.fn(),
  discardIncidentDraftForCurrentSession: vi.fn(),
  getIncidentDraftForCurrentSession: vi.fn(),
}));
import { getAuthServerEnvironment } from "@/lib/env/auth-server";
import { getIncidentServerEnvironment } from "@/lib/env/incident-server";
import { getRuntimeEnvironment } from "@/lib/env/runtime";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { authorizeCurrentSession } from "@/server/auth/current-session";
import {
  saveIncidentDraftForAuthorizedSession,
  discardIncidentDraftForCurrentSession,
} from "@/server/incidents/incident-drafts";
import { issueSessionCsrfToken } from "@/server/security/session-csrf";
import { POST } from "./route";
import { DELETE } from "./[draftId]/route";
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

function request(
  body: string,
  overrides: Record<string, string> = {},
  method = "POST",
) {
  const csrf = issueSessionCsrfToken(session.sessionId, "k".repeat(32));
  return new Request(
    "https://guided-operations.example.test/api/web/v1/incident-drafts?revision=2",
    {
      method,
      headers: {
        origin: "https://guided-operations.example.test",
        "content-type": "application/json",
        cookie: `go-csrf-digest=${csrf.digest}`,
        "x-csrf-token": csrf.token,
        ...overrides,
      },
      ...(method === "POST" ? { body } : {}),
    },
  );
}
beforeEach(() => {
  vi.clearAllMocks();
  mockEnvironment();
  vi.mocked(authorizeCurrentSession).mockResolvedValue(session);
});
it("rejects expired sessions before reading unfinished input", async () => {
  vi.mocked(authorizeCurrentSession).mockResolvedValue({
    allowed: false,
    reason: "unauthenticated",
  } as never);
  expect((await POST(request("{"))).status).toBe(401);
  expect(saveIncidentDraftForAuthorizedSession).not.toHaveBeenCalled();
});
it("rejects untrusted origin and missing CSRF before saving", async () => {
  for (const headers of [
    { origin: "https://untrusted.example.test" },
    { "x-csrf-token": "" },
  ] as Record<string, string>[])
    expect((await POST(request("{}", headers))).status).toBe(403);
  expect(saveIncidentDraftForAuthorizedSession).not.toHaveBeenCalled();
});
it("reports malformed and excessive JSON without invoking persistence", async () => {
  expect((await POST(request("{"))).status).toBe(400);
  expect((await POST(request("x".repeat(1048577)))).status).toBe(413);
  expect(saveIncidentDraftForAuthorizedSession).not.toHaveBeenCalled();
});
it("passes discard revision and reports stale discard as conflict", async () => {
  vi.mocked(discardIncidentDraftForCurrentSession).mockResolvedValue({
    kind: "conflict",
  });
  const response = await DELETE(request("", {}, "DELETE"), {
    params: Promise.resolve({ draftId: session.account.authUserId }),
  });
  expect(response.status).toBe(409);
  expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  expect(discardIncidentDraftForCurrentSession).toHaveBeenCalledWith(
    session.account.authUserId,
    2,
    client,
  );
});
