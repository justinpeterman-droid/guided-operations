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
vi.mock("@/server/paperwork/restore-count-sheet-revision", () => ({
  restoreCountSheetRevisionForCurrentSession: vi.fn(),
}));
vi.mock("@/server/paperwork/restore-count-sheet-revision-endpoint", () => ({
  validateCountSheetRestoreRequest: vi.fn(),
}));

import { getAuthServerEnvironment } from "@/lib/env/auth-server";
import { getIncidentServerEnvironment } from "@/lib/env/incident-server";
import { getRuntimeEnvironment } from "@/lib/env/runtime";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { authorizeCurrentSession } from "@/server/auth/current-session";
import { restoreCountSheetRevisionForCurrentSession } from "@/server/paperwork/restore-count-sheet-revision";
import { validateCountSheetRestoreRequest } from "@/server/paperwork/restore-count-sheet-revision-endpoint";

import { POST } from "./route";

const client = {};
const recordId = "11111111-1111-4111-8111-111111111111";

describe("POST Count Sheet revision restore", () => {
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

  it("returns the new immutable revision number after protected restore", async () => {
    vi.mocked(validateCountSheetRestoreRequest).mockResolvedValue({
      ok: true,
      baseRevisionNumber: 2,
      restoreRevisionNumber: 1,
      reason: "Fictional restore.",
      idempotencyKey: "fictional-restore-key-1234",
    });
    vi.mocked(restoreCountSheetRevisionForCurrentSession).mockResolvedValue({
      kind: "restored",
      revisionNumber: 3,
    });
    const response = await POST(new Request("https://example.test"), {
      params: Promise.resolve({ recordId }),
    });
    expect(response.status).toBe(201);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    await expect(response.json()).resolves.toMatchObject({
      data: { revisionNumber: 3 },
    });
  });

  it("keeps stale restore attempts as explicit conflicts", async () => {
    vi.mocked(validateCountSheetRestoreRequest).mockResolvedValue({
      ok: true,
      baseRevisionNumber: 2,
      restoreRevisionNumber: 1,
      reason: "Fictional stale restore.",
      idempotencyKey: "fictional-restore-key-1234",
    });
    vi.mocked(restoreCountSheetRevisionForCurrentSession).mockResolvedValue({
      kind: "conflict",
    });
    const response = await POST(new Request("https://example.test"), {
      params: Promise.resolve({ recordId }),
    });
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "revision_conflict" },
    });
  });
});
