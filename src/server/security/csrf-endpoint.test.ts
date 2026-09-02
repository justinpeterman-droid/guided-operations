import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { issueCsrfForCurrentSession } from "./csrf-endpoint";
import {
  CSRF_DIGEST_COOKIE,
  CSRF_TOKEN_COOKIE,
  issueSessionCsrfToken,
} from "./session-csrf";

const row = {
  auth_user_id: "11111111-1111-4111-8111-111111111111",
  facility_id: "22222222-2222-4222-8222-222222222222",
  role: "officer",
  status: "active",
  auth_version: 1,
  must_change_passcode: false,
};

function client(claims: unknown) {
  return {
    auth: {
      getClaims: vi.fn().mockResolvedValue({ data: { claims }, error: null }),
    },
    rpc: vi.fn().mockResolvedValue({ data: [row], error: null }),
  };
}

describe("issueCsrfForCurrentSession", () => {
  it("reuses a valid current-session pair instead of rotating it", async () => {
    const sessionId = "33333333-3333-4333-8333-333333333333";
    const key = "k".repeat(32);
    const existing = issueSessionCsrfToken(sessionId, key);
    const headers = new Headers({
      cookie: `${CSRF_TOKEN_COOKIE}=${existing.token}; ${CSRF_DIGEST_COOKIE}=${existing.digest}`,
    });

    await expect(
      issueCsrfForCurrentSession(
        client({
          sub: row.auth_user_id,
          session_id: sessionId,
          app_metadata: { auth_version: 1 },
        }),
        key,
        {},
        headers,
      ),
    ).resolves.toEqual({ kind: "reused", token: existing.token });
  });

  it("issues a token only for a current verified session", async () => {
    await expect(
      issueCsrfForCurrentSession(
        client({
          sub: row.auth_user_id,
          session_id: "33333333-3333-4333-8333-333333333333",
          app_metadata: { auth_version: 1 },
        }),
        "k".repeat(32),
      ),
    ).resolves.toMatchObject({
      kind: "issued",
      token: { token: expect.any(String), digest: expect.any(String) },
    });
  });

  it("does not issue a token for a missing session authority", async () => {
    await expect(
      issueCsrfForCurrentSession(client({}), "k".repeat(32)),
    ).resolves.toEqual({ kind: "denied" });
  });
});
