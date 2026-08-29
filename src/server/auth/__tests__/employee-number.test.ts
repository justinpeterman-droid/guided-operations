import { describe, expect, it } from "vitest";

import {
  employeeLookupDigest,
  normalizeEmployeeNumber,
} from "../employee-number";

describe("employee number normalization", () => {
  it("normalizes Unicode, whitespace, and case", () => {
    expect(normalizeEmployeeNumber("  ab-１２３  ")).toBe("AB-123");
  });

  it("rejects control characters and unsupported punctuation", () => {
    expect(() => normalizeEmployeeNumber("AB\u0000-123")).toThrow();
    expect(() => normalizeEmployeeNumber("AB/123")).toThrow();
  });

  it("creates a keyed deterministic lookup digest", () => {
    const first = employeeLookupDigest("ab-123", "pepper-one");
    const second = employeeLookupDigest(" AB-123 ", "pepper-one");
    const otherPepper = employeeLookupDigest("AB-123", "pepper-two");

    expect(first).toMatch(/^[a-f0-9]{64}$/);
    expect(second).toBe(first);
    expect(otherPepper).not.toBe(first);
  });
});
