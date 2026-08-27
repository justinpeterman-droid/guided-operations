import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env/runtime", () => ({ getRuntimeEnvironment: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(),
}));
vi.mock("@/server/auth/current-session", () => ({
  authorizeCurrentSession: vi.fn(),
}));
vi.mock("@/server/observability/safe-operational-event", () => ({
  writeSafeOperationalEvent: vi.fn(),
}));
vi.mock("@/server/policy/policy-source-reader", () => ({
  getAuthorizedPolicySource: vi.fn(),
  readAuthorizedPolicySourcePdf: vi.fn(),
}));
vi.mock("@/server/policy/supabase-policy-source-storage", () => ({
  createSupabasePolicySourceStorageReader: vi.fn(),
}));

import { getRuntimeEnvironment } from "@/lib/env/runtime";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { authorizeCurrentSession } from "@/server/auth/current-session";
import { writeSafeOperationalEvent } from "@/server/observability/safe-operational-event";
import {
  getAuthorizedPolicySource,
  readAuthorizedPolicySourcePdf,
} from "@/server/policy/policy-source-reader";
import { createSupabasePolicySourceStorageReader } from "@/server/policy/supabase-policy-source-storage";

import { GET } from "./route";

const documentVersionId = "22222222-2222-4222-8222-222222222222";
const client = {};
const storage = {};
const source = { documentVersionId };
const session = {
  allowed: true as const,
  account: {
    authUserId: "11111111-1111-4111-8111-111111111111",
    facilityId: "33333333-3333-4333-8333-333333333333",
    shiftCode: "A" as const,
    role: "officer" as const,
    status: "active" as const,
    authVersion: 1,
    mustChangePasscode: false,
  },
  sessionId: "44444444-4444-4444-8444-444444444444",
};

function context() {
  return {
    params: Promise.resolve({ documentVersionId }),
  } as never;
}

function mockFoundation() {
  vi.mocked(getRuntimeEnvironment).mockReturnValue({
    APP_ENV: "preview",
    APP_ORIGIN: "https://guided-operations.example.test",
  });
  vi.mocked(createSupabaseServerClient).mockResolvedValue(client as never);
}

describe("GET /api/web/v1/policy-sources/[documentVersionId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFoundation();
  });

  it("serves only a verified private PDF with restrictive response headers", async () => {
    const pdf = new Blob(["%PDF-fictional"], { type: "application/pdf" });
    vi.mocked(authorizeCurrentSession).mockResolvedValue(session);
    vi.mocked(getAuthorizedPolicySource).mockResolvedValue(source as never);
    vi.mocked(createSupabasePolicySourceStorageReader).mockReturnValue(
      storage as never,
    );
    vi.mocked(readAuthorizedPolicySourcePdf).mockResolvedValue({
      kind: "ready",
      pdf,
      filename: "fictional-policy-abc123.pdf",
    });

    const response = await GET(
      new Request("https://example.test/api/web/v1/policy-sources/x"),
      context(),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe(
      "private, no-store, max-age=0",
    );
    expect(response.headers.get("Content-Type")).toBe("application/pdf");
    expect(response.headers.get("Content-Disposition")).toBe(
      'inline; filename="fictional-policy-abc123.pdf"',
    );
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(response.headers.get("Cross-Origin-Resource-Policy")).toBe(
      "same-origin",
    );
    await expect(response.text()).resolves.toBe("%PDF-fictional");
    expect(getAuthorizedPolicySource).toHaveBeenCalledWith(
      client,
      documentVersionId,
    );
    expect(readAuthorizedPolicySourcePdf).toHaveBeenCalledWith(source, storage);
    expect(writeSafeOperationalEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        event_name: "policy_source.read",
        outcome: "served",
        status_code: 200,
      }),
    );
  });

  it("stops before source or privileged Storage access without a current session", async () => {
    vi.mocked(authorizeCurrentSession).mockResolvedValue({
      allowed: false,
      reason: "missing_account",
    });

    const response = await GET(new Request("https://example.test"), context());

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "authentication_required" },
    });
    expect(getAuthorizedPolicySource).not.toHaveBeenCalled();
    expect(createSupabasePolicySourceStorageReader).not.toHaveBeenCalled();
  });

  it("conceals denied, missing, or malformed source versions as not found", async () => {
    vi.mocked(authorizeCurrentSession).mockResolvedValue(session);
    vi.mocked(getAuthorizedPolicySource).mockResolvedValue(null);

    const response = await GET(new Request("https://example.test"), context());

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "not_found", message: "Request could not be completed." },
    });
    expect(createSupabasePolicySourceStorageReader).not.toHaveBeenCalled();
  });

  it.each(["integrity_failure", "storage_unavailable"] as const)(
    "returns no source details when reading ends in %s",
    async (kind) => {
      vi.mocked(authorizeCurrentSession).mockResolvedValue(session);
      vi.mocked(getAuthorizedPolicySource).mockResolvedValue(source as never);
      vi.mocked(createSupabasePolicySourceStorageReader).mockReturnValue(
        storage as never,
      );
      vi.mocked(readAuthorizedPolicySourcePdf).mockResolvedValue({ kind });

      const response = await GET(
        new Request("https://example.test"),
        context(),
      );

      expect(response.status).toBe(503);
      expect(await response.text()).not.toContain(documentVersionId);
      expect(writeSafeOperationalEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          event_name: "policy_source.read",
          outcome:
            kind === "integrity_failure"
              ? "integrity_failed"
              : "storage_unavailable",
          status_code: 503,
        }),
      );
    },
  );
});
