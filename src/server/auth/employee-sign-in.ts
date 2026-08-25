import "server-only";

import { createHmac } from "node:crypto";

import {
  GENERIC_SIGN_IN_FAILURE,
  normalizeEmployeeNumber,
} from "@/features/auth/credentials";

export type AuthAliasLookup = {
  findActiveAlias(
    employeeLookupDigest: string,
  ): Promise<{ alias: string } | null>;
};

export type PasswordAuthenticator = {
  signInWithPassword(alias: string, passcode: string): Promise<boolean>;
};

export type EmployeeSignInDependencies = {
  aliasLookup: AuthAliasLookup;
  passwordAuthenticator: PasswordAuthenticator;
  employeeLookupHmacKey: string;
  /** A real, non-user-facing alias maintained only by the auth adapter. */
  dummyAlias: string;
};

export type EmployeeSignInResult =
  | { status: "signed_in" }
  | { status: "failed"; message: typeof GENERIC_SIGN_IN_FAILURE };

export function createEmployeeLookupDigest(
  normalizedEmployeeNumber: string,
  employeeLookupHmacKey: string,
): string {
  if (!employeeLookupHmacKey) {
    throw new Error("Employee lookup HMAC key is required.");
  }

  return createHmac("sha256", employeeLookupHmacKey)
    .update(normalizedEmployeeNumber, "utf8")
    .digest("hex");
}

/**
 * Server-side-only authentication orchestration. The browser receives neither
 * an Auth alias nor a distinction between unknown, disabled, and wrong-secret
 * outcomes.
 */
export async function signInWithEmployeeNumber(
  employeeNumber: string,
  passcode: string,
  dependencies: EmployeeSignInDependencies,
): Promise<EmployeeSignInResult> {
  const normalizedEmployeeNumber = normalizeEmployeeNumber(employeeNumber);
  const employeeLookupDigest = createEmployeeLookupDigest(
    normalizedEmployeeNumber,
    dependencies.employeeLookupHmacKey,
  );
  const account =
    await dependencies.aliasLookup.findActiveAlias(employeeLookupDigest);

  // Both paths make a password-authentication call. The adapter owns the
  // dedicated dummy account and never exposes its alias to this layer's caller.
  const authenticated =
    await dependencies.passwordAuthenticator.signInWithPassword(
      account?.alias ?? dependencies.dummyAlias,
      passcode,
    );

  if (!account || !authenticated) {
    return { status: "failed", message: GENERIC_SIGN_IN_FAILURE };
  }

  return { status: "signed_in" };
}
