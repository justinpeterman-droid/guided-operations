import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { createAdminInviteAuthorization } from "./authorize-admin-invite";

const currentSession = {
  authUserId: "aaaaaaaa-0000-4000-8000-000000000001",
  sessionId: "bbbbbbbb-0000-4000-8000-000000000001",
  authVersion: 4,
};

describe("createAdminInviteAuthorization", () => {
  it("consumes only the exact account-create proof bound to the current session", async () => {
    const store = { issue: vi.fn(), consume: vi.fn().mockResolvedValue(true) };
    const authorization = createAdminInviteAuthorization(
      {
        requestId: "cccccccc-0000-4000-8000-000000000001",
        token: "x".repeat(43),
      },
      currentSession,
      { store, hmacKey: "k".repeat(32) },
    );

    await expect(authorization.consume()).resolves.toEqual({
      actorAuthUserId: currentSession.authUserId,
    });
    expect(store.consume).toHaveBeenCalledWith(
      expect.objectContaining({
        authUserId: currentSession.authUserId,
        sessionId: currentSession.sessionId,
        authVersion: currentSession.authVersion,
        purpose: "account.create",
        tokenDigest: expect.any(String),
      }),
    );
  });

  it("does not touch storage when the proof is malformed", async () => {
    const store = { issue: vi.fn(), consume: vi.fn() };
    const authorization = createAdminInviteAuthorization(
      { requestId: "not-a-uuid", token: "short" },
      currentSession,
      { store, hmacKey: "k".repeat(32) },
    );

    await expect(authorization.consume()).resolves.toBeNull();
    expect(store.consume).not.toHaveBeenCalled();
  });
});
