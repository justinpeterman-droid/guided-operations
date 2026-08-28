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
vi.mock("@/server/paperwork/get-daily-paperwork", () => ({
  getDailyPaperworkForCurrentSession: vi.fn(),
}));
vi.mock("@/server/paperwork/save-daily-paperwork-endpoint", () => ({
  validateDailyPaperworkSaveRequest: vi.fn(),
}));
vi.mock("@/server/paperwork/save-daily-paperwork", () => ({
  saveDailyPaperworkForCurrentSession: vi.fn(),
}));

import { getAuthServerEnvironment } from "@/lib/env/auth-server";
import { getIncidentServerEnvironment } from "@/lib/env/incident-server";
import { getRuntimeEnvironment } from "@/lib/env/runtime";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { authorizeCurrentSession } from "@/server/auth/current-session";
import { validateDailyPaperworkSaveRequest } from "@/server/paperwork/save-daily-paperwork-endpoint";
import { saveDailyPaperworkForCurrentSession } from "@/server/paperwork/save-daily-paperwork";

import { POST } from "./route";

const client = {};
const command = {
  kind: "assignment_roster" as const,
  workDate: "2026-08-27",
  shiftCode: "F" as const,
  baseRevisionNumber: 0,
  payload: { schema_version: 1, fields: {}, tables: {} },
  reason: "Fictional initial save.",
  idempotencyKey: "fictional-daily-save-key-1234",
};

describe("POST /api/web/v1/daily-paperwork", () => {
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

  it("passes only the closed save command to the protected workflow", async () => {
    vi.mocked(validateDailyPaperworkSaveRequest).mockResolvedValue({
      ok: true,
      ...command,
    });
    vi.mocked(saveDailyPaperworkForCurrentSession).mockResolvedValue({
      kind: "saved",
      recordId: "11111111-1111-4111-8111-111111111111",
      revisionNumber: 1,
    });

    const response = await POST(new Request("https://example.test"));

    expect(response.status).toBe(201);
    expect(saveDailyPaperworkForCurrentSession).toHaveBeenCalledWith(
      command,
      client,
      "i".repeat(32),
    );
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  });
});
