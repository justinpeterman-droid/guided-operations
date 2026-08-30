import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { changeAccountRole } from "./change-account-role";

describe("changeAccountRole", () => {
  it("consumes one fresh admin approval before changing a target role", async () => {
    const authorization = {
      consume: vi.fn().mockResolvedValue({ actorAuthUserId: "fixture-admin" }),
    };
    const store = { changeRole: vi.fn().mockResolvedValue(undefined) };
    await expect(
      changeAccountRole(
        {
          targetAuthUserId: "aaaaaaaa-0000-4000-8000-000000000001",
          newRole: "administrator",
        },
        { authorization, store },
      ),
    ).resolves.toBe("changed");
    expect(store.changeRole).toHaveBeenCalledWith(
      "fixture-admin",
      "aaaaaaaa-0000-4000-8000-000000000001",
      "administrator",
    );
  });

  it("does not call storage without a valid one-time approval", async () => {
    const authorization = { consume: vi.fn().mockResolvedValue(null) };
    const store = { changeRole: vi.fn() };
    await expect(
      changeAccountRole(
        {
          targetAuthUserId: "aaaaaaaa-0000-4000-8000-000000000001",
          newRole: "officer",
        },
        { authorization, store },
      ),
    ).resolves.toBe("denied");
    expect(store.changeRole).not.toHaveBeenCalled();
  });
});
