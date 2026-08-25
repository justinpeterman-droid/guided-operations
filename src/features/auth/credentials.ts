/**
 * Credential policy that is safe to share between a sign-in form and a
 * server-side authentication adapter. It intentionally does not decide how
 * employee identifiers are stored or looked up.
 */
export const MINIMUM_PASSCODE_LENGTH = 8;

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
      reason: "too_short" | "matches_employee_number" | "common_pattern";
    };

/**
 * Candidate normalization for the familiar employee-number input. Keeping
 * punctuation intact avoids silently changing the identity before the owner
 * confirms the final employee-number format.
 */
export function normalizeEmployeeNumber(value: string): string {
  return value.normalize("NFKC").trim().toUpperCase();
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

  const canonicalPasscode = passcode.normalize("NFKC");
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
