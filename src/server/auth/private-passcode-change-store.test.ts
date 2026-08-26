import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { createTemporaryPasscodeChangeStore } from "./private-passcode-change-store";

describe("createTemporaryPasscodeChangeStore", () => {
  it("keeps the completion transaction behind a server-only narrow facade", async () => {
    const persistence = { complete: vi.fn().mockResolvedValue(undefined) };
    const store = createTemporaryPasscodeChangeStore(persistence);
    const input = {
      authUserId: "fixture-user",
      employeeLookupDigest: "a".repeat(64),
    };

    await store.complete(input);

    expect(persistence.complete).toHaveBeenCalledWith(input);
  });
});
