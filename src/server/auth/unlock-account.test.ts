import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { unlockAccount } from "./unlock-account";

describe("unlockAccount", () => {
  it("uses one fresh admin approval before unlocking a target account", async () => {
    const authorization = {
      consume: vi.fn().mockResolvedValue({ actorAuthUserId: "fixture-admin" }),
    };
    const store = { unlock: vi.fn().mockResolvedValue(undefined) };
    await expect(
      unlockAccount(
        { targetAuthUserId: "aaaaaaaa-0000-4000-8000-000000000001" },
        { authorization, store },
      ),
    ).resolves.toBe("unlocked");
    expect(store.unlock).toHaveBeenCalledWith(
      "fixture-admin",
      "aaaaaaaa-0000-4000-8000-000000000001",
    );
  });

  it("does not call storage without a valid input and one-time approval", async () => {
    const authorization = { consume: vi.fn().mockResolvedValue(null) };
    const store = { unlock: vi.fn() };
    await expect(
      unlockAccount({ targetAuthUserId: "bad" }, { authorization, store }),
    ).resolves.toBe("denied");
    expect(store.unlock).not.toHaveBeenCalled();
  });
});
