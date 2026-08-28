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
vi.mock("@/server/paperwork/restore-daily-paperwork-revision", () => ({
  restoreDailyPaperworkRevisionForCurrentSession: vi.fn(),
}));
vi.mock("@/server/paperwork/restore-daily-paperwork-revision-endpoint", () => ({
  validateDailyPaperworkRestoreRequest: vi.fn(),
}));

import { getAuthServerEnvironment } from "@/lib/env/auth-server";
import { getIncidentServerEnvironment } from "@/lib/env/incident-server";
import { getRuntimeEnvironment } from "@/lib/env/runtime";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { authorizeCurrentSession } from "@/server/auth/current-session";
import { validateDailyPaperworkRestoreRequest } from "@/server/paperwork/restore-daily-paperwork-revision-endpoint";
import { restoreDailyPaperworkRevisionForCurrentSession } from "@/server/paperwork/restore-daily-paperwork-revision";

import { POST } from "./route";

const client = {};
const recordId = "11111111-1111-4111-8111-111111111111";
const command = {
  recordId,
  baseRevisionNumber: 2,
  restoreRevisionNumber: 1,
  reason: "Fictional restore.",
  idempotencyKey: "fictional-daily-restore-key-1234",
};

describe("POST Daily Paperwork revision restore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getAuthServerEnvironment).mockReturnValue({
      CSRF_HMAC_KEY: "c".repeat(32),
    } as never);
    vi.mocked(getIncidentServerEnvironment).mockReturnValue({
      INCIDENT_IDEMPOTENCY_HMAC_KEY: "i".repeat(32),
    });
    vi.mocked(getRuntimeEnvironment).mockReturnValue({
      APP_ORIGIN: "https://example.test",
    } as never);
    vi.mocked(createSupabaseServerClient).mockResolvedValue(client as never);
    vi.mocked(authorizeCurrentSession).mockResolvedValue({
      allowed: true,
      sessionId: "22222222-2222-4222-8222-222222222222",
    } as never);
  });

  it("passes only the closed restore command to the protected workflow", async () => {
    vi.mocked(validateDailyPaperworkRestoreRequest).mockResolvedValue({
      ok: true,
      baseRevisionNumber: command.baseRevisionNumber,
      restoreRevisionNumber: command.restoreRevisionNumber,
      reason: command.reason,
      idempotencyKey: command.idempotencyKey,
    });
    vi.mocked(restoreDailyPaperworkRevisionForCurrentSession).mockResolvedValue(
      {
        kind: "restored",
        revisionNumber: 3,
      },
    );

    const response = await POST(new Request("https://example.test"), {
      params: Promise.resolve({ recordId }),
    });

    expect(response.status).toBe(201);
    expect(restoreDailyPaperworkRevisionForCurrentSession).toHaveBeenCalledWith(
      command,
      client,
      "i".repeat(32),
    );
  });
});
