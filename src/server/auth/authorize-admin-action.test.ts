import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { createAdminActionAuthorization } from "./authorize-admin-action";

describe("createAdminActionAuthorization", () => {
  it("binds consumption to the named high-impact action", async () => {
    const store = { issue: vi.fn(), consume: vi.fn().mockResolvedValue(true) };
    const authorization = createAdminActionAuthorization(
      "account.disable",
      {
        requestId: "aaaaaaaa-0000-4000-8000-000000000001",
        token: "x".repeat(43),
      },
      {
        authUserId: "bbbbbbbb-0000-4000-8000-000000000001",
        sessionId: "cccccccc-0000-4000-8000-000000000001",
        authVersion: 3,
      },
      { store, hmacKey: "k".repeat(32) },
    );

    await expect(authorization.consume()).resolves.toEqual({
      actorAuthUserId: "bbbbbbbb-0000-4000-8000-000000000001",
    });
    expect(store.consume).toHaveBeenCalledWith(
      expect.objectContaining({ purpose: "account.disable" }),
    );
  });
});
