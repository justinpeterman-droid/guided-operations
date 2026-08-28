/**
 * Credential policy that is safe to share between a sign-in form and a
 * server-side authentication adapter. It intentionally does not decide how
 * employee identifiers are stored or looked up.
 */
export const MINIMUM_PASSCODE_LENGTH = 8;
export const MAXIMUM_PASSCODE_LENGTH = 64;
export const MINIMUM_EMPLOYEE_NUMBER_LENGTH = 3;
export const MAXIMUM_EMPLOYEE_NUMBER_LENGTH = 32;

const EMPLOYEE_NUMBER_PATTERN = /^[A-Z0-9](?:[A-Z0-9._/-]*[A-Z0-9])$/u;

const COMMON_PASSCODES = new Set([
  "12345678",
  "123456789",
  "password",
  "password1",
  "qwertyui",
  "letmein1",
  "welcome1",
]);

export type PasscodeValidation =
  | { valid: true }
  | {
      valid: false;
      reason:
        | "too_short"
        | "too_long"
        | "unsupported_characters"
        | "matches_employee_number"
        | "common_pattern";
    };

/**
 * The initial single-facility contract preserves leading zeroes and approved
 * separators while removing only compatibility/case/outer-space differences.
 */
export function normalizeEmployeeNumber(value: string): string {
  return value.normalize("NFKC").trim().toUpperCase();
}

export function isAllowedEmployeeNumber(value: string): boolean {
  const normalized = normalizeEmployeeNumber(value);
  return (
    normalized.length >= MINIMUM_EMPLOYEE_NUMBER_LENGTH &&
    normalized.length <= MAXIMUM_EMPLOYEE_NUMBER_LENGTH &&
    EMPLOYEE_NUMBER_PATTERN.test(normalized)
  );
}

function usesAllowedPasscodeCharacters(value: string): boolean {
  for (const character of value) {
    const codePoint = character.codePointAt(0);
    if (codePoint === undefined || codePoint < 33 || codePoint > 126) {
      return false;
    }
  }
  return true;
}

function isRepeatedCharacter(value: string): boolean {
  return /^(.)\1+$/u.test(value);
}

function isSimpleSequence(value: string): boolean {
  const alphabet = "0123456789abcdefghijklmnopqrstuvwxyz";
  const normalized = value.toLowerCase();

  return (
    alphabet.includes(normalized) ||
    alphabet.split("").reverse().join("").includes(normalized)
  );
}

export function validatePasscode(
  passcode: string,
  normalizedEmployeeNumber: string,
): PasscodeValidation {
  if (passcode.length < MINIMUM_PASSCODE_LENGTH) {
    return { valid: false, reason: "too_short" };
  }
  if (passcode.length > MAXIMUM_PASSCODE_LENGTH) {
    return { valid: false, reason: "too_long" };
  }
  if (!usesAllowedPasscodeCharacters(passcode)) {
    return { valid: false, reason: "unsupported_characters" };
  }

  const canonicalPasscode = passcode;
  if (
    normalizedEmployeeNumber.length > 0 &&
    canonicalPasscode.toUpperCase() === normalizedEmployeeNumber
  ) {
    return { valid: false, reason: "matches_employee_number" };
  }

  if (
    COMMON_PASSCODES.has(canonicalPasscode.toLowerCase()) ||
    isRepeatedCharacter(canonicalPasscode) ||
    isSimpleSequence(canonicalPasscode)
  ) {
    return { valid: false, reason: "common_pattern" };
  }

  return { valid: true };
}

/** Public authentication responses must not disclose account existence. */
export const GENERIC_SIGN_IN_FAILURE =
  "Unable to sign in with those credentials.";
