import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { createPersonalSessionRevocationStore } from "./personal-session-revocation-store";

describe("createPersonalSessionRevocationStore", () => {
  it("keeps account-wide revocation behind a server-only facade", async () => {
    const persistence = {
      beginAll: vi.fn().mockResolvedValue(7),
      completeAll: vi.fn().mockResolvedValue(8),
    };
    const store = createPersonalSessionRevocationStore(persistence);

    await expect(store.beginAll("fixture-user", 6)).resolves.toBe(7);
    await expect(store.completeAll("fixture-user", 7)).resolves.toBe(8);
    expect(persistence.beginAll).toHaveBeenCalledWith("fixture-user", 6);
    expect(persistence.completeAll).toHaveBeenCalledWith("fixture-user", 7);
  });
});
