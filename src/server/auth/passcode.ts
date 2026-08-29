import { Algorithm, hash, verify } from "@node-rs/argon2";

import { normalizeEmployeeNumber } from "./employee-number";

const MIN_PASSCODE_LENGTH = 10;
const MAX_PASSCODE_LENGTH = 64;
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f]/;
const REPEATED_CHARACTER_PATTERN = /^(.)\1{9,}$/s;
const COMMON_VALUES = [
  "1234567890",
  "0987654321",
  "0123456789",
  "password12",
  "password123",
  "qwerty1234",
  "letmein123",
  "welcome123",
  "administrator",
];

export type PasscodeValidationResult =
  | { success: true }
  | { success: false; reason: string };

export function validateNewPasscode(
  employeeNumber: string,
  passcode: string,
): PasscodeValidationResult {
  const length = Array.from(passcode).length;

  if (length < MIN_PASSCODE_LENGTH || length > MAX_PASSCODE_LENGTH) {
    return { success: false, reason: "length" };
  }

  if (CONTROL_CHARACTER_PATTERN.test(passcode)) {
    return { success: false, reason: "control-character" };
  }

  if (!/[A-Za-z]/.test(passcode) || !/[0-9]/.test(passcode)) {
    return { success: false, reason: "character-mix" };
  }

  const lower = passcode.toLocaleLowerCase("en-US");
  if (
    COMMON_VALUES.some(
      (value) => lower === value || lower.startsWith(`${value}!`),
    )
  ) {
    return { success: false, reason: "common" };
  }

  if (REPEATED_CHARACTER_PATTERN.test(passcode)) {
    return { success: false, reason: "repeated" };
  }

  const normalizedEmployee = normalizeEmployeeNumber(employeeNumber);
  if (passcode.toUpperCase().includes(normalizedEmployee)) {
    return { success: false, reason: "employee-number" };
  }

  const compactEmployee = normalizedEmployee.replace(/-/g, "");
  const compactPasscode = passcode.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (
    compactEmployee.length >= 4 &&
    compactPasscode.includes(compactEmployee)
  ) {
    return { success: false, reason: "employee-number" };
  }

  if (isSimpleSequence(passcode)) {
    return { success: false, reason: "sequence" };
  }

  return { success: true };
}

export async function hashPasscode(passcode: string): Promise<string> {
  return hash(passcode, {
    algorithm: Algorithm.Argon2id,
    memoryCost: 19_456,
    timeCost: 2,
    parallelism: 1,
    outputLen: 32,
  });
}

export async function verifyPasscode(
  passcodeHash: string,
  passcode: string,
): Promise<boolean> {
  try {
    return await verify(passcodeHash, passcode);
  } catch {
    return false;
  }
}

function isSimpleSequence(value: string): boolean {
  const compact = value.replace(/[^A-Za-z0-9]/g, "").toLowerCase();
  if (compact.length < MIN_PASSCODE_LENGTH) {
    return false;
  }

  const sequences = [
    "0123456789abcdefghijklmnopqrstuvwxyz",
    "abcdefghijklmnopqrstuvwxyz0123456789",
    "9876543210zyxwvutsrqponmlkjihgfedcba",
    "zyxwvutsrqponmlkjihgfedcba9876543210",
  ];

  return sequences.some((sequence) => sequence.includes(compact));
}
