import { createHash } from "node:crypto";

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(),
}));
vi.mock("@/server/auth/current-session", () => ({
  authorizeCurrentSession: vi.fn(),
}));
vi.mock("@/server/feedback/private-improvement-store", () => ({
  createPrivateImprovementStore: vi.fn(),
}));

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { authorizeCurrentSession } from "@/server/auth/current-session";
import { createPrivateImprovementStore } from "@/server/feedback/private-improvement-store";

import { GET } from "./route";

const requestId = "22222222-2222-4222-8222-222222222222";
const bytes = new TextEncoder().encode("%PDF-fictional blank candidate");
const session = {
  allowed: true as const,
  account: {
    authUserId: "11111111-1111-4111-8111-111111111111",
    facilityId: "33333333-3333-4333-8333-333333333333",
    shiftCode: "A" as const,
    role: "administrator" as const,
    status: "active" as const,
    authVersion: 1,
    mustChangePasscode: false,
  },
  sessionId: "44444444-4444-4444-8444-444444444444",
};
const store = {
  getReviewableFormCandidate: vi.fn(),
};
const download = vi.fn();
const client = {
  storage: {
    from: vi.fn(() => ({ download })),
  },
};

function context() {
  return { params: Promise.resolve({ requestId }) } as never;
}

describe("GET /api/web/v1/improvement-requests/[requestId]/form-candidate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createSupabaseServerClient).mockResolvedValue(client as never);
    vi.mocked(createPrivateImprovementStore).mockReturnValue(store as never);
  });

  it("streams a verified private candidate only after administrator authorization", async () => {
    vi.mocked(authorizeCurrentSession).mockResolvedValue(session);
    store.getReviewableFormCandidate.mockResolvedValue({
      storageBucket: "form-candidate-quarantine",
      storagePath: "fictional/private/candidate.pdf",
      originalFilename: 'fictional "candidate".pdf',
      actualMediaType: "application/pdf",
      actualByteSize: bytes.byteLength,
      actualSha256: createHash("sha256").update(bytes).digest("hex"),
    });
    download.mockResolvedValue({
      data: new Blob([bytes], { type: "application/pdf" }),
      error: null,
    });

    const response = await GET(new Request("https://example.test"), context());

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe(
      "private, no-store, max-age=0",
    );
    expect(response.headers.get("Content-Type")).toBe("application/pdf");
    expect(response.headers.get("Content-Disposition")).toBe(
      'attachment; filename="fictional _candidate_.pdf"',
    );
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(response.headers.get("Cross-Origin-Resource-Policy")).toBe(
      "same-origin",
    );
    await expect(response.text()).resolves.toBe(
      "%PDF-fictional blank candidate",
    );
    expect(authorizeCurrentSession).toHaveBeenCalledWith(client, {
      requiredRole: "administrator",
    });
    expect(store.getReviewableFormCandidate).toHaveBeenCalledWith(
      requestId,
      session.account.facilityId,
    );
    expect(client.storage.from).toHaveBeenCalledWith(
      "form-candidate-quarantine",
    );
  });

  it("does not query private candidate metadata without an administrator session", async () => {
    vi.mocked(authorizeCurrentSession).mockResolvedValue({
      allowed: false,
      reason: "missing_account",
    });

    const response = await GET(new Request("https://example.test"), context());

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "authentication_required" },
    });
    expect(store.getReviewableFormCandidate).not.toHaveBeenCalled();
    expect(client.storage.from).not.toHaveBeenCalled();
  });

  it("does not serve a changed Storage object", async () => {
    vi.mocked(authorizeCurrentSession).mockResolvedValue(session);
    store.getReviewableFormCandidate.mockResolvedValue({
      storageBucket: "form-candidate-quarantine",
      storagePath: "fictional/private/candidate.pdf",
      originalFilename: "fictional-candidate.pdf",
      actualMediaType: "application/pdf",
      actualByteSize: bytes.byteLength,
      actualSha256: "f".repeat(64),
    });
    download.mockResolvedValue({ data: new Blob([bytes]), error: null });

    const response = await GET(new Request("https://example.test"), context());

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "service_unavailable" },
    });
  });
});
