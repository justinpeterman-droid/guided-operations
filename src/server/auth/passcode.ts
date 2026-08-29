import {
  randomBytes,
  scrypt as nodeScrypt,
  timingSafeEqual,
} from "node:crypto";

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

const SCRYPT_VERSION = 1;
const SCRYPT_N = 32_768;
const SCRYPT_R = 8;
const SCRYPT_P = 3;
const SCRYPT_KEY_LENGTH = 32;
const SCRYPT_SALT_LENGTH = 16;
const SCRYPT_MAX_MEMORY = 64 * 1024 * 1024;

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
  const salt = randomBytes(SCRYPT_SALT_LENGTH);
  const derivedKey = await deriveScrypt(passcode, salt);

  return [
    "scrypt",
    `v=${SCRYPT_VERSION}`,
    `N=${SCRYPT_N}`,
    `r=${SCRYPT_R}`,
    `p=${SCRYPT_P}`,
    salt.toString("base64url"),
    derivedKey.toString("base64url"),
  ].join("$");
}

export async function verifyPasscode(
  passcodeHash: string,
  passcode: string,
): Promise<boolean> {
  const parsed = parsePasscodeHash(passcodeHash);
  if (!parsed) {
    return false;
  }

  try {
    const actual = await deriveScrypt(passcode, parsed.salt);
    return timingSafeEqual(actual, parsed.derivedKey);
  } catch {
    return false;
  }
}

function parsePasscodeHash(
  value: string,
): { salt: Buffer; derivedKey: Buffer } | null {
  const parts = value.split("$");
  if (
    parts.length !== 7 ||
    parts[0] !== "scrypt" ||
    parts[1] !== `v=${SCRYPT_VERSION}` ||
    parts[2] !== `N=${SCRYPT_N}` ||
    parts[3] !== `r=${SCRYPT_R}` ||
    parts[4] !== `p=${SCRYPT_P}`
  ) {
    return null;
  }

  try {
    const salt = Buffer.from(parts[5], "base64url");
    const derivedKey = Buffer.from(parts[6], "base64url");

    if (
      salt.length !== SCRYPT_SALT_LENGTH ||
      derivedKey.length !== SCRYPT_KEY_LENGTH
    ) {
      return null;
    }

    return { salt, derivedKey };
  } catch {
    return null;
  }
}

function deriveScrypt(passcode: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    nodeScrypt(
      passcode,
      salt,
      SCRYPT_KEY_LENGTH,
      {
        N: SCRYPT_N,
        r: SCRYPT_R,
        p: SCRYPT_P,
        maxmem: SCRYPT_MAX_MEMORY,
      },
      (error, derivedKey) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(derivedKey);
      },
    );
  });
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
