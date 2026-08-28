import { describe, expect, it } from "vitest";

import {
  GENERIC_SIGN_IN_FAILURE,
  isAllowedEmployeeNumber,
  MAXIMUM_EMPLOYEE_NUMBER_LENGTH,
  MAXIMUM_PASSCODE_LENGTH,
  MINIMUM_PASSCODE_LENGTH,
  normalizeEmployeeNumber,
  validatePasscode,
} from "./credentials";

describe("normalizeEmployeeNumber", () => {
  it("trims, case-folds, and normalizes compatibility characters", () => {
    expect(normalizeEmployeeNumber("  \uff45\uff4d\uff50-42  ")).toBe("EMP-42");
  });

  it("does not silently remove identifier punctuation", () => {
    expect(normalizeEmployeeNumber("ab-42/7")).toBe("AB-42/7");
  });

  it("accepts the bounded initial-facility identifier alphabet", () => {
    for (const value of ["141432", "EMP-42", "AB_42/7", "A.042"]) {
      expect(isAllowedEmployeeNumber(value)).toBe(true);
    }
    expect(MAXIMUM_EMPLOYEE_NUMBER_LENGTH).toBe(32);
  });

  it("rejects ambiguous, unbounded, or control-containing identifiers", () => {
    for (const value of [
      "AB",
      "EMP 42",
      "-EMP42",
      "EMP42-",
      "EMP\\42",
      "EMP\n42",
      "A".repeat(33),
    ]) {
      expect(isAllowedEmployeeNumber(value)).toBe(false);
    }
  });
});

describe("validatePasscode", () => {
  const employeeNumber = normalizeEmployeeNumber("emp-42");

  it("enforces the approved minimum length", () => {
    expect(MINIMUM_PASSCODE_LENGTH).toBe(8);
    expect(validatePasscode("short7", employeeNumber)).toEqual({
      valid: false,
      reason: "too_short",
    });
  });

  it("rejects a passcode equal to the employee number", () => {
    expect(validatePasscode("EMP-42", employeeNumber)).toEqual({
      valid: false,
      reason: "too_short",
    });
    expect(
      validatePasscode("EMP-0042", normalizeEmployeeNumber("emp-0042")),
    ).toEqual({
      valid: false,
      reason: "matches_employee_number",
    });
  });

  it("rejects common, repeated, and simple sequential passcodes", () => {
    for (const passcode of ["password1", "aaaaaaaa", "12345678", "87654321"]) {
      expect(validatePasscode(passcode, employeeNumber)).toEqual({
        valid: false,
        reason: "common_pattern",
      });
    }
  });

  it("accepts a non-common passcode without exposing account state", () => {
    expect(validatePasscode("Cedar7!9", employeeNumber)).toEqual({
      valid: true,
    });
    expect(GENERIC_SIGN_IN_FAILURE).toBe(
      "Unable to sign in with those credentials.",
    );
  });

  it("requires 8 to 64 printable non-space ASCII characters", () => {
    expect(MAXIMUM_PASSCODE_LENGTH).toBe(64);
    expect(validatePasscode("A".repeat(65), employeeNumber)).toEqual({
      valid: false,
      reason: "too_long",
    });
    for (const passcode of ["Cedar 7!9", "Cedar7!\n", "Cedar7!é"]) {
      expect(validatePasscode(passcode, employeeNumber)).toEqual({
        valid: false,
        reason: "unsupported_characters",
      });
    }
    expect(validatePasscode("Maple_Ridge-47!", employeeNumber)).toEqual({
      valid: true,
    });
  });
});
