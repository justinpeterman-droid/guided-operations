import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/env/auth-server", () => ({ getAuthServerEnvironment: vi.fn() }));
vi.mock("@/lib/env/runtime", () => ({ getRuntimeEnvironment: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(),
}));
vi.mock("@/server/auth/current-session", () => ({
  authorizeCurrentSession: vi.fn(),
}));
vi.mock("@/server/auth/private-admin-step-up-store", () => ({
  createAdminStepUpStore: vi.fn(() => ({})),
}));
vi.mock("@/server/auth/request-admin-step-up", () => ({
  requestAdminStepUp: vi.fn(),
}));
vi.mock("@/server/auth/supabase-auth-adapters", () => ({
  createSupabaseAdministratorPasscodeVerifier: vi.fn(() => ({})),
}));
vi.mock("@/server/ai/private-policy-review-store", () => ({
  createPolicyReviewStore: vi.fn(),
}));

import { getAuthServerEnvironment } from "@/lib/env/auth-server";
import { getRuntimeEnvironment } from "@/lib/env/runtime";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { authorizeCurrentSession } from "@/server/auth/current-session";
import { requestAdminStepUp } from "@/server/auth/request-admin-step-up";
import { createPolicyReviewStore } from "@/server/ai/private-policy-review-store";
import { issueSessionCsrfToken } from "@/server/security/session-csrf";
import { POST } from "./route";

const id = "aaaaaaaa-0000-4000-8000-000000000001";
const origin = "https://fictional.example.test";
const key = "k".repeat(32);
const session = {
  allowed: true,
  account: { authUserId: id, authVersion: 1, role: "administrator" },
  sessionId: id,
};
const snapshot = {
  protocol: "policy-full-review-v1",
  versionId: id,
  runId: id,
  sourceSha256: "a".repeat(64),
  registrySha256: "b".repeat(64),
  pages: [
    { page: 1, textSha256: "c".repeat(64), evidenceSha256: "c".repeat(64) },
  ],
  chunks: [
    {
      id,
      ordinal: 0,
      pageStart: 1,
      pageEnd: 1,
      textSha256: "d".repeat(64),
      evidenceSha256: "d".repeat(64),
    },
  ],
};
const review = {
  ...snapshot,
  reviewId: id,
  sourceReviewed: true,
  reviewRecordSha256: "e".repeat(64),
  pages: snapshot.pages.map((p) => ({ ...p, reviewed: true })),
  chunks: snapshot.chunks.map((c) => ({ ...c, reviewed: true })),
};
const store = { snapshot: vi.fn(), approve: vi.fn() };
function request(body: unknown, changes: Record<string, string> = {}) {
  const csrf = issueSessionCsrfToken(id, key);
  return new Request(`${origin}/api/admin/policy-review`, {
    method: "POST",
    headers: {
      origin,
      "content-type": "application/json",
      "x-csrf-token": csrf.token,
      cookie: `go-csrf=${csrf.token}; go-csrf-digest=${csrf.digest}`,
      ...changes,
    },
    body: JSON.stringify(body),
  });
}
const prepare = { action: "prepare", versionId: id, runId: id };
const approve = { action: "approve", review, passcode: "FictionalPasscode!" };

describe("authenticated policy operator route", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv("POLICY_CORPUS_REVIEW_ENABLED", "true");
    vi.mocked(getRuntimeEnvironment).mockReturnValue({
      APP_ENV: "production",
      APP_ORIGIN: origin,
    });
    vi.mocked(getAuthServerEnvironment).mockReturnValue({
      CSRF_HMAC_KEY: key,
    } as never);
    vi.mocked(createSupabaseServerClient).mockResolvedValue({
      auth: {},
    } as never);
    vi.mocked(authorizeCurrentSession).mockResolvedValue(session as never);
    vi.mocked(createPolicyReviewStore).mockReturnValue(store);
    store.snapshot.mockResolvedValue(snapshot);
    store.approve.mockResolvedValue("approved_for_embedding");
    vi.mocked(requestAdminStepUp).mockResolvedValue({
      status: "issued",
      requestId: id,
      token: "fictional-proof",
    });
  });
  afterEach(() => vi.unstubAllEnvs());
  it("prepares only metadata, without issuing approval proof", async () => {
    const response = await POST(request(prepare));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(await response.json()).toEqual({ data: snapshot });
    expect(requestAdminStepUp).not.toHaveBeenCalled();
    expect(store.approve).not.toHaveBeenCalled();
  });
  it("uses verified session identity and fresh purpose-bound proof without returning it", async () => {
    const response = await POST(request(approve));
    expect(response.status).toBe(200);
    expect(requestAdminStepUp).toHaveBeenCalledWith(
      expect.anything(),
      "policy.review",
      { passcode: approve.passcode },
      expect.anything(),
    );
    expect(store.approve).toHaveBeenCalledWith(
      session,
      review,
      id,
      expect.stringMatching(/^[A-Za-z0-9_-]{43}$/u),
    );
    expect(await response.json()).toEqual({
      data: { status: "approved_for_embedding", searchable: false },
    });
  });
  it.each(["preview", "development", "test"] as const)(
    "disables the endpoint in %s",
    async (APP_ENV) => {
      vi.mocked(getRuntimeEnvironment).mockReturnValue({
        APP_ENV,
        APP_ORIGIN: origin,
      });
      expect((await POST(request(prepare))).status).toBe(404);
      expect(createSupabaseServerClient).not.toHaveBeenCalled();
    },
  );
  it("is disabled unless the reviewed release enables the feature", async () => {
    vi.stubEnv("POLICY_CORPUS_REVIEW_ENABLED", "false");
    expect((await POST(request(approve))).status).toBe(404);
  });
  it("denies unauthorized sessions before reading input", async () => {
    vi.mocked(authorizeCurrentSession).mockResolvedValue({
      allowed: false,
      reason: "session_revoked",
    });
    expect((await POST(request(approve))).status).toBe(401);
    expect(authorizeCurrentSession).toHaveBeenCalledWith(expect.anything(), {
      requiredRole: "administrator",
    });
    expect(createPolicyReviewStore).not.toHaveBeenCalled();
  });
  it.each<Record<string, string>>([
    { origin: "https://other.example.test" },
    { "x-csrf-token": "forged" },
    { "sec-fetch-site": "cross-site" },
  ])("rejects origin/CSRF tampering", async (headers) => {
    expect((await POST(request(approve, headers))).status).toBe(403);
    expect(createPolicyReviewStore).not.toHaveBeenCalled();
  });
  it.each([
    { ...review, actor: id },
    { ...review, sourceReviewed: false },
    { ...review, pages: [{ ...review.pages[0], reviewed: false }] },
  ])("rejects unreviewed or forged input", async (badReview) => {
    expect(
      (await POST(request({ ...approve, review: badReview }))).status,
    ).toBe(400);
    expect(requestAdminStepUp).not.toHaveBeenCalled();
  });
  it("rejects oversized input without trusting content-length", async () => {
    expect((await POST(request({ payload: "x".repeat(524288) }))).status).toBe(
      413,
    );
    expect(createPolicyReviewStore).not.toHaveBeenCalled();
  });
  it("a failed fresh passcode check never mutates corpus QA", async () => {
    vi.mocked(requestAdminStepUp).mockResolvedValue({ status: "denied" });
    expect((await POST(request(approve))).status).toBe(401);
    expect(store.approve).not.toHaveBeenCalled();
  });
  it.each([
    ["40001", 409],
    ["42501", 403],
    ["XX000", 503],
  ])("redacts SQL failure %s", async (code, expected) => {
    store.approve.mockRejectedValue({
      code,
      detail: "fictional source text",
      message: "fictional credential",
    });
    const response = await POST(request(approve));
    expect(response.status).toBe(expected);
    expect(await response.text()).not.toMatch(/fictional/);
  });
});
