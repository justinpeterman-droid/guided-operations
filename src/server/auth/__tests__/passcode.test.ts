import { describe, expect, it } from "vitest";

import {
  hashPasscode,
  validateNewPasscode,
  verifyPasscode,
} from "../passcode";

describe("passcode policy", () => {
  it("accepts a strong individual passcode", () => {
    expect(validateNewPasscode("AB-123", "CorrectHorse9").success).toBe(true);
  });

  it("rejects employee-number equality and predictable values", () => {
    expect(validateNewPasscode("AB-123", "AB-123AB-123").success).toBe(false);
    expect(validateNewPasscode("AB-123", "aaaaaaaaaa").success).toBe(false);
    expect(validateNewPasscode("AB-123", "1234567890").success).toBe(false);
    expect(validateNewPasscode("AB-123", "password12").success).toBe(false);
  });

  it("rejects values outside the 10 to 64 character boundary", () => {
    expect(validateNewPasscode("AB-123", "Short9").success).toBe(false);
    expect(validateNewPasscode("AB-123", "A".repeat(65)).success).toBe(false);
  });

  it("hashes with the fixed OWASP scrypt profile and verifies safely", async () => {
    const hash = await hashPasscode("CorrectHorse9");

    expect(hash).toMatch(
      /^scrypt\$v=1\$N=32768\$r=8\$p=3\$[A-Za-z0-9_-]{22}\$[A-Za-z0-9_-]{43}$/,
    );
    await expect(verifyPasscode(hash, "CorrectHorse9")).resolves.toBe(true);
    await expect(verifyPasscode(hash, "WrongHorse9")).resolves.toBe(false);
    await expect(
      verifyPasscode(hash.replace("N=32768", "N=16384"), "CorrectHorse9"),
    ).resolves.toBe(false);
  });
});
