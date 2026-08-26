import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { createPersonalPasscodeChangeStore } from "./personal-passcode-change-store";

describe("createPersonalPasscodeChangeStore", () => {
  it("keeps identity verification and recording behind a server-only facade", async () => {
    const persistence = {
      verifyIdentity: vi.fn().mockResolvedValue(true),
      prepare: vi.fn().mockResolvedValue(undefined),
      record: vi.fn().mockResolvedValue(undefined),
    };
    const store = createPersonalPasscodeChangeStore(persistence);

    await expect(
      store.verifyIdentity("fixture-user", "a".repeat(64)),
    ).resolves.toBe(true);
    await store.prepare("fixture-user", "a".repeat(64));
    await store.record("fixture-user", "a".repeat(64));

    expect(persistence.prepare).toHaveBeenCalledWith(
      "fixture-user",
      "a".repeat(64),
    );
    expect(persistence.record).toHaveBeenCalledWith(
      "fixture-user",
      "a".repeat(64),
    );
  });
});
