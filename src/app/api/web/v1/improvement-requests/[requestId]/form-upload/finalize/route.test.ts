import { createHash } from "node:crypto";
import { beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({
  authorize: vi.fn(),
  candidate: vi.fn(),
  finalize: vi.fn(),
  download: vi.fn(),
  csrf: vi.fn(),
}));
vi.mock("@/lib/env/auth-server", () => ({
  getAuthServerEnvironment: () => ({ CSRF_HMAC_KEY: "fictional-key" }),
}));
vi.mock("@/lib/env/runtime", () => ({
  getRuntimeEnvironment: () => ({ APP_ORIGIN: "http://127.0.0.1:3000" }),
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: () => ({
    storage: { from: () => ({ download: mocks.download }) },
  }),
}));
vi.mock("@/server/auth/current-session", () => ({
  authorizeCurrentSession: mocks.authorize,
}));
vi.mock("@/server/security/session-csrf", () => ({
  hasValidSessionCsrfRequest: mocks.csrf,
}));
vi.mock("@/server/feedback/private-improvement-store", () => ({
  createPrivateImprovementStore: () => ({
    getFormCandidateForUpload: mocks.candidate,
    finalizeFormCandidate: mocks.finalize,
  }),
}));
import { POST } from "./route";
const requestId = "22222222-2222-4222-8222-222222222222";
const owner = "11111111-1111-4111-8111-111111111111";
const facility = "33333333-3333-4333-8333-333333333333";
const bytes = new TextEncoder().encode("%PDF-fictional blank form");
function request(origin = "http://localhost:3000") {
  return new Request(
    `${origin}/api/web/v1/improvement-requests/${requestId}/form-upload/finalize`,
    { method: "POST", headers: { origin }, body: "{}" },
  );
}
const context = { params: Promise.resolve({ requestId }) };
beforeEach(() => {
  vi.resetAllMocks();
  mocks.authorize.mockResolvedValue({
    allowed: true,
    sessionId: "fictional-session",
    account: { authUserId: owner, facilityId: facility },
  });
  mocks.csrf.mockReturnValue(true);
  mocks.candidate.mockResolvedValue({
    storagePath: "fictional/quarantine/source",
    declaredMediaType: "application/pdf",
    declaredByteSize: bytes.length,
    declaredSha256: createHash("sha256").update(bytes).digest("hex"),
    uploadState: "uploading",
  });
  mocks.download.mockResolvedValue({ data: new Blob([bytes]), error: null });
  mocks.finalize.mockResolvedValue(undefined);
});
it("recovers a lost finalization response from an owner's already verified upload", async () => {
  mocks.candidate.mockResolvedValue({ uploadState: "uploaded" });
  const response = await POST(request(), context);
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ data: { finalized: true } });
  expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  expect(mocks.candidate).toHaveBeenCalledWith(requestId, owner, facility);
  expect(mocks.download).not.toHaveBeenCalled();
  expect(mocks.finalize).not.toHaveBeenCalled();
});
it("verifies bytes before finalizing a pending upload", async () => {
  expect((await POST(request(), context)).status).toBe(200);
  expect(mocks.finalize).toHaveBeenCalledWith(
    requestId,
    owner,
    bytes.length,
    createHash("sha256").update(bytes).digest("hex"),
    "application/pdf",
  );
});
it("accepts the local hostname alias while rejecting cross-site fetch metadata", async () => {
  expect((await POST(request("http://localhost:3000"), context)).status).toBe(
    200,
  );
  mocks.candidate.mockClear();
  const crossSite = request("http://localhost:3000");
  crossSite.headers.set("sec-fetch-site", "cross-site");
  expect((await POST(crossSite, context)).status).toBe(403);
  expect(mocks.candidate).not.toHaveBeenCalled();
});
it("keeps a missing object recoverable without confirming it", async () => {
  mocks.download.mockResolvedValue({ error: { message: "fictional missing" } });
  const response = await POST(request(), context);
  expect(response.status).toBe(409);
  expect(await response.json()).toMatchObject({
    error: { code: "upload_not_ready" },
  });
  expect(mocks.finalize).not.toHaveBeenCalled();
});
it("rejects different bytes instead of accepting an existing object blindly", async () => {
  mocks.download.mockResolvedValue({
    data: new Blob(["%PDF-other fictional content"]),
    error: null,
  });
  expect((await POST(request(), context)).status).toBe(400);
  expect(mocks.finalize).not.toHaveBeenCalled();
});
it("does not expose upload state for another owner, facility, or expired candidate", async () => {
  mocks.candidate.mockResolvedValue(null);
  expect((await POST(request(), context)).status).toBe(404);
  expect(mocks.download).not.toHaveBeenCalled();
});
it("requires the current session, origin, and CSRF before upload lookup", async () => {
  mocks.authorize.mockResolvedValueOnce({ allowed: false });
  expect((await POST(request(), context)).status).toBe(401);
  expect((await POST(request("http://wrong.test"), context)).status).toBe(403);
  mocks.csrf.mockReturnValue(false);
  expect((await POST(request(), context)).status).toBe(403);
  expect(mocks.candidate).not.toHaveBeenCalled();
});
