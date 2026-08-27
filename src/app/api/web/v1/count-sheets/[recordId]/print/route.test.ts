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
vi.mock("@/server/paperwork/record-count-sheet-print", () => ({
  recordCountSheetPrintForCurrentSession: vi.fn(),
}));
vi.mock("@/server/paperwork/record-count-sheet-print-endpoint", () => ({
  validateCountSheetPrintRequest: vi.fn(),
}));

import { getAuthServerEnvironment } from "@/lib/env/auth-server";
import { getIncidentServerEnvironment } from "@/lib/env/incident-server";
import { getRuntimeEnvironment } from "@/lib/env/runtime";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { authorizeCurrentSession } from "@/server/auth/current-session";
import { recordCountSheetPrintForCurrentSession } from "@/server/paperwork/record-count-sheet-print";
import { validateCountSheetPrintRequest } from "@/server/paperwork/record-count-sheet-print-endpoint";

import { POST } from "./route";

const client = {};
const recordId = "11111111-1111-4111-8111-111111111111";

describe("POST Count Sheet print audit", () => {
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

  it("records the current saved revision before returning permission to print", async () => {
    vi.mocked(validateCountSheetPrintRequest).mockResolvedValue({
      ok: true,
      revisionNumber: 3,
      idempotencyKey: "fictional-print-key-1234",
    });
    vi.mocked(recordCountSheetPrintForCurrentSession).mockResolvedValue({
      kind: "recorded",
    });
    const response = await POST(new Request("https://example.test"), {
      params: Promise.resolve({ recordId }),
    });
    expect(response.status).toBe(201);
    expect(recordCountSheetPrintForCurrentSession).toHaveBeenCalledWith(
      {
        recordId,
        requestId: expect.any(String),
        revisionNumber: 3,
        idempotencyKey: "fictional-print-key-1234",
      },
      client,
      "i".repeat(32),
    );
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    await expect(response.json()).resolves.toMatchObject({
      data: { recorded: true },
    });
  });

  it("returns a conflict instead of authorizing print for a stale revision", async () => {
    vi.mocked(validateCountSheetPrintRequest).mockResolvedValue({
      ok: true,
      revisionNumber: 2,
      idempotencyKey: "fictional-print-key-1234",
    });
    vi.mocked(recordCountSheetPrintForCurrentSession).mockResolvedValue({
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
