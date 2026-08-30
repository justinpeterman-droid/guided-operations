import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { createTemporaryPasscode } from "./temporary-passcode";

describe("createTemporaryPasscode", () => {
  it("always satisfies the hosted password character policy", () => {
    for (let sample = 0; sample < 1_000; sample += 1) {
      const passcode = createTemporaryPasscode();
      expect(passcode).toMatch(/^[A-HJ-NP-Za-km-z2-9]{20}$/);
      expect(passcode).toMatch(/[A-Za-z]/);
      expect(passcode).toMatch(/[0-9]/);
    }
  });
});
