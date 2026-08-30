import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { disableAccount } from "./disable-account";

describe("disableAccount", () => {
  it("consumes the administrator approval before changing a target account", async () => {
    const authorization = {
      consume: vi.fn().mockResolvedValue({ actorAuthUserId: "fixture-admin" }),
    };
    const store = { disable: vi.fn().mockResolvedValue(undefined) };

    await expect(
      disableAccount(
        { targetAuthUserId: "aaaaaaaa-0000-4000-8000-000000000001" },
        { authorization, store },
      ),
    ).resolves.toBe("disabled");
    expect(store.disable).toHaveBeenCalledWith(
      "fixture-admin",
      "aaaaaaaa-0000-4000-8000-000000000001",
    );
  });

  it("does not call the database for malformed or unapproved requests", async () => {
    const authorization = { consume: vi.fn().mockResolvedValue(null) };
    const store = { disable: vi.fn() };

    await expect(
      disableAccount(
        { targetAuthUserId: "not-a-uuid" },
        { authorization, store },
      ),
    ).resolves.toBe("denied");
    await expect(
      disableAccount(
        { targetAuthUserId: "aaaaaaaa-0000-4000-8000-000000000001" },
        { authorization, store },
      ),
    ).resolves.toBe("denied");
    expect(store.disable).not.toHaveBeenCalled();
  });
});
