import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env/auth-server", () => ({ getAuthServerEnvironment: vi.fn() }));
vi.mock("@/lib/env/runtime", () => ({ getRuntimeEnvironment: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(),
}));
vi.mock("@/server/auth/authorize-admin-action", () => ({
  createAdminActionAuthorization: vi.fn(() => ({})),
}));
vi.mock("@/server/auth/current-session", () => ({
  authorizeCurrentSession: vi.fn(),
}));
vi.mock("@/server/auth/private-admin-step-up-store", () => ({
  createAdminStepUpStore: vi.fn(() => ({})),
}));
vi.mock("@/server/security/request-origin", () => ({
  isTrustedMutationRequest: vi.fn(),
}));
vi.mock("@/server/security/session-csrf", () => ({
  hasValidSessionCsrfRequest: vi.fn(),
}));
vi.mock("@/server/retention/private-retention-deletion-store", () => ({
  createRetentionDeletionStore: vi.fn(() => ({})),
}));
vi.mock("@/server/retention/retention-deletion", () => ({
  executeRetentionDeletion: vi.fn(),
}));
vi.mock("@/server/retention/supabase-retention-artifact-cleanup", () => ({
  createSupabaseRetentionArtifactCleanup: vi.fn(() => ({})),
}));

import { getAuthServerEnvironment } from "@/lib/env/auth-server";
import { getRuntimeEnvironment } from "@/lib/env/runtime";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createAdminActionAuthorization } from "@/server/auth/authorize-admin-action";
import { authorizeCurrentSession } from "@/server/auth/current-session";
import { isTrustedMutationRequest } from "@/server/security/request-origin";
import { hasValidSessionCsrfRequest } from "@/server/security/session-csrf";
import { executeRetentionDeletion } from "@/server/retention/retention-deletion";

import { POST } from "./route";

const origin = "https://guided-operations.example.test";
const requestId = "44444444-4444-4444-8444-444444444444";
const recordId = "55555555-5555-4555-8555-555555555555";
const client = { auth: {} };

describe("POST /api/admin/retention-deletions/:requestId/execute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
      APP_ORIGIN: origin,
    });
    vi.mocked(createSupabaseServerClient).mockResolvedValue(client as never);
    vi.mocked(authorizeCurrentSession).mockResolvedValue({
      allowed: true,
      account: {
        authUserId: "11111111-1111-4111-8111-111111111111",
        authVersion: 2,
      },
      sessionId: "22222222-2222-4222-8222-222222222222",
    } as never);
    vi.mocked(isTrustedMutationRequest).mockReturnValue(true);
    vi.mocked(hasValidSessionCsrfRequest).mockReturnValue(true);
    vi.mocked(executeRetentionDeletion).mockResolvedValue({
      status: "completed",
      databaseRowsDeleted: 7,
      artifactsDeleted: 1,
    });
  });

  it("uses a separate execution proof and exact record confirmation", async () => {
    const response = await POST(
      new Request(
        `${origin}/api/admin/retention-deletions/${requestId}/execute`,
        {
          method: "POST",
          body: JSON.stringify({
            requestId: "66666666-6666-4666-8666-666666666666",
            token: "x".repeat(43),
            confirmRecordId: recordId,
          }),
        },
      ),
      { params: Promise.resolve({ requestId }) },
    );

    expect(response.status).toBe(200);
    expect(executeRetentionDeletion).toHaveBeenCalledWith(
      { requestId, confirmRecordId: recordId },
      expect.any(Object),
    );
    expect(createAdminActionAuthorization).toHaveBeenCalledWith(
      "retention.execute_deletion",
      expect.any(Object),
      expect.any(Object),
      expect.any(Object),
    );
  });

  it("does not start execution for an untrusted request", async () => {
    vi.mocked(isTrustedMutationRequest).mockReturnValue(false);
    const response = await POST(
      new Request(
        `${origin}/api/admin/retention-deletions/${requestId}/execute`,
        { method: "POST" },
      ),
      { params: Promise.resolve({ requestId }) },
    );

    expect(response.status).toBe(403);
    expect(executeRetentionDeletion).not.toHaveBeenCalled();
  });
});
