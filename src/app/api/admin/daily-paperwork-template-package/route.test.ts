import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env/auth-server", () => ({ getAuthServerEnvironment: vi.fn() }));
vi.mock("@/lib/env/runtime", () => ({ getRuntimeEnvironment: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(),
}));
vi.mock("@/server/auth/current-session", () => ({
  authorizeCurrentSession: vi.fn(),
}));
vi.mock("@/server/paperwork/daily-paperwork-template-package-command", () => ({
  runDailyPaperworkTemplatePackageCommand: vi.fn(),
}));
vi.mock(
  "@/server/paperwork/private-daily-paperwork-template-package-store",
  () => ({ createDailyPaperworkTemplatePackageStore: vi.fn(() => ({})) }),
);
vi.mock("@/server/security/request-origin", () => ({
  isTrustedMutationRequest: vi.fn(),
}));
vi.mock("@/server/security/session-csrf", () => ({
  hasValidSessionCsrfRequest: vi.fn(),
}));
vi.mock("@/server/observability/safe-operational-event", () => ({
  writeSafeOperationalEvent: vi.fn(),
}));

import { getAuthServerEnvironment } from "@/lib/env/auth-server";
import { getRuntimeEnvironment } from "@/lib/env/runtime";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { authorizeCurrentSession } from "@/server/auth/current-session";
import { runDailyPaperworkTemplatePackageCommand } from "@/server/paperwork/daily-paperwork-template-package-command";
import { writeSafeOperationalEvent } from "@/server/observability/safe-operational-event";
import { isTrustedMutationRequest } from "@/server/security/request-origin";
import { hasValidSessionCsrfRequest } from "@/server/security/session-csrf";

import { POST } from "./route";

const origin = "https://guided-operations.example.test";
const client = { auth: {} };
const session = {
  allowed: true as const,
  account: {
    authUserId: "00000000-0000-4000-8000-000000000002",
    facilityId: "00000000-0000-4000-8000-000000000001",
    authVersion: 1,
  },
  sessionId: "00000000-0000-4000-8000-000000000003",
};

function mockEnvironment(appEnv: "preview" | "production") {
  vi.mocked(getAuthServerEnvironment).mockReturnValue({
    SUPABASE_SECRET_KEY: "unused",
    SUPABASE_DB_URL: "https://db.example.test",
    EMPLOYEE_LOOKUP_PEPPER: "p".repeat(32),
    AUTH_DUMMY_ALIAS: "dummy@example.test",
    CSRF_HMAC_KEY: "k".repeat(32),
    AUTH_SIGN_IN_ENABLED: false,
  });
  vi.mocked(getRuntimeEnvironment).mockReturnValue({
    APP_ENV: appEnv,
    APP_ORIGIN: origin,
  });
  vi.mocked(createSupabaseServerClient).mockResolvedValue(client as never);
}

function request(): Request {
  const fields = new Map<string, string>([
    ["action", "validate"],
    ["sourceAuthority", "Fictional records owner"],
    ["sourceRevision", "fictional-revision-1"],
    ["activeFrom", "2026-09-01"],
  ]);
  const files = [
    "assignment_roster.json",
    "uniform_inspection.json",
    "metal_detector_test.json",
    "perimeter_check.json",
    "random_search_log.json",
    "detector_sign_out.json",
  ].map((filename) => ({
    name: filename,
    size: 2,
    type: "application/json",
    arrayBuffer: async () => new TextEncoder().encode("{}").buffer,
  }));
  const incoming = new Request(
    `${origin}/api/admin/daily-paperwork-template-package`,
    {
      method: "POST",
      headers: {
        "content-type": "multipart/form-data; boundary=test",
        "content-length": "1000",
      },
    },
  );
  vi.spyOn(incoming, "formData").mockResolvedValue({
    getAll: (name: string) => (name === "files" ? files : []),
    get: (name: string) => fields.get(name) ?? null,
  } as unknown as FormData);
  return incoming;
}

describe("POST /api/admin/daily-paperwork-template-package", () => {
  beforeEach(() => vi.clearAllMocks());

  it("does not exist in Preview even for a valid request", async () => {
    mockEnvironment("preview");
    const response = await POST(request());
    const responseRequestId = response.headers.get("x-request-id");
    expect(response.status).toBe(404);
    expect(responseRequestId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u,
    );
    expect(authorizeCurrentSession).not.toHaveBeenCalled();
    expect(runDailyPaperworkTemplatePackageCommand).not.toHaveBeenCalled();
    expect(writeSafeOperationalEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        event_name: "daily_paperwork_package.request",
        outcome: "not_found",
        request_id: responseRequestId,
        status_code: 404,
        environment: "preview",
      }),
    );
  });

  it("reviews a bounded six-file package only after admin, origin, and CSRF checks", async () => {
    mockEnvironment("production");
    vi.mocked(authorizeCurrentSession).mockResolvedValue(session as never);
    vi.mocked(isTrustedMutationRequest).mockReturnValue(true);
    vi.mocked(hasValidSessionCsrfRequest).mockReturnValue(true);
    vi.mocked(runDailyPaperworkTemplatePackageCommand).mockResolvedValue({
      status: "reviewed",
      evidence: {
        schemaVersion: 1,
        packageDigest: "a".repeat(64),
        sourceCount: 6,
      },
    } as never);

    const response = await POST(request());
    const responseRequestId = response.headers.get("x-request-id");
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(responseRequestId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u,
    );
    expect(runDailyPaperworkTemplatePackageCommand).toHaveBeenCalledOnce();
    const command = vi.mocked(runDailyPaperworkTemplatePackageCommand).mock
      .calls[0][0];
    expect(command.files).toHaveLength(6);
    await expect(response.json()).resolves.toEqual({
      data: {
        evidence: {
          schemaVersion: 1,
          packageDigest: "a".repeat(64),
          sourceCount: 6,
        },
      },
      meta: { request_id: responseRequestId, api_version: "web-v1" },
    });
    expect(writeSafeOperationalEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        event_name: "daily_paperwork_package.request",
        outcome: "reviewed",
        request_id: responseRequestId,
        status_code: 200,
        environment: "production",
      }),
    );
  });

  it("rejects cross-site requests before reading the private files", async () => {
    mockEnvironment("production");
    vi.mocked(authorizeCurrentSession).mockResolvedValue(session as never);
    vi.mocked(isTrustedMutationRequest).mockReturnValue(false);
    const response = await POST(request());
    expect(response.status).toBe(403);
    expect(runDailyPaperworkTemplatePackageCommand).not.toHaveBeenCalled();
    expect(writeSafeOperationalEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        outcome: "request_not_allowed",
        status_code: 403,
      }),
    );
  });

  it("rejects missing or oversized request lengths before reading the body", async () => {
    mockEnvironment("production");
    vi.mocked(authorizeCurrentSession).mockResolvedValue(session as never);
    vi.mocked(isTrustedMutationRequest).mockReturnValue(true);
    vi.mocked(hasValidSessionCsrfRequest).mockReturnValue(true);

    const missingLength = request();
    missingLength.headers.delete("content-length");
    const missingResponse = await POST(missingLength);
    expect(missingResponse.status).toBe(400);
    expect(missingLength.formData).not.toHaveBeenCalled();

    const oversized = request();
    oversized.headers.set("content-length", "2000001");
    const oversizedResponse = await POST(oversized);
    expect(oversizedResponse.status).toBe(400);
    expect(oversized.formData).not.toHaveBeenCalled();
    expect(runDailyPaperworkTemplatePackageCommand).not.toHaveBeenCalled();
  });
});
