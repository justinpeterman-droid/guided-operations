import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { changeAccountShift } from "./change-account-shift";

describe("changeAccountShift", () => {
  it("consumes one fresh approval before changing the assigned shift", async () => {
    const authorization = {
      consume: vi.fn().mockResolvedValue({ actorAuthUserId: "fixture-admin" }),
    };
    const store = { changeShift: vi.fn().mockResolvedValue(undefined) };

    await expect(
      changeAccountShift(
        {
          targetAuthUserId: "aaaaaaaa-0000-4000-8000-000000000001",
          newShiftCode: "U",
        },
        { authorization, store },
      ),
    ).resolves.toBe("changed");
    expect(store.changeShift).toHaveBeenCalledWith(
      "fixture-admin",
      "aaaaaaaa-0000-4000-8000-000000000001",
      "U",
    );
  });

  it("rejects an unapproved shift before consuming the proof", async () => {
    const authorization = { consume: vi.fn() };
    const store = { changeShift: vi.fn() };

    await expect(
      changeAccountShift(
        {
          targetAuthUserId: "aaaaaaaa-0000-4000-8000-000000000001",
          newShiftCode: "Z",
        },
        { authorization, store },
      ),
    ).resolves.toBe("denied");
    expect(authorization.consume).not.toHaveBeenCalled();
    expect(store.changeShift).not.toHaveBeenCalled();
  });
});
