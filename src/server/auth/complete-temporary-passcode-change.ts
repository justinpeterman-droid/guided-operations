import "server-only";

import { z } from "zod";

import {
  normalizeEmployeeNumber,
  validatePasscode,
} from "@/features/auth/credentials";

import { createEmployeeLookupDigest } from "./employee-sign-in";
import type { TemporaryPasscodeChangeStore } from "./private-passcode-change-store";

const inputSchema = z
  .object({
    employeeNumber: z.string().min(1).max(128),
    passcode: z.string().min(1).max(256),
  })
  .strict();

export type PasswordChangeClient = Readonly<{
  auth: Readonly<{
    updateUser(
      input: Readonly<{ password: string }>,
    ): Promise<Readonly<{ error: unknown | null }>>;
    signOut(
      input: Readonly<{ scope: "global" }>,
    ): Promise<Readonly<{ error: unknown | null }>>;
  }>;
}>;

export type CompleteTemporaryPasscodeChangeDependencies = Readonly<{
  employeeLookupHmacKey: string;
  store: TemporaryPasscodeChangeStore;
}>;

export type CompleteTemporaryPasscodeChangeResult =
  | { status: "completed" }
  | { status: "invalid_input" }
  | { status: "unavailable" };

/**
 * Replaces a system temporary credential. It validates the personal passcode
 * before writing to Auth, then atomically clears the matching forced-change
 * state in the private database. The account trigger revokes stale sessions.
 */
export async function completeTemporaryPasscodeChange(
  input: unknown,
  authUserId: string,
  client: PasswordChangeClient,
  dependencies: CompleteTemporaryPasscodeChangeDependencies,
): Promise<CompleteTemporaryPasscodeChangeResult> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return { status: "invalid_input" };

  const normalizedEmployeeNumber = normalizeEmployeeNumber(
    parsed.data.employeeNumber,
  );
  if (!validatePasscode(parsed.data.passcode, normalizedEmployeeNumber).valid) {
    return { status: "invalid_input" };
  }

  const passwordResult = await client.auth.updateUser({
    password: parsed.data.passcode,
  });
  if (passwordResult.error) return { status: "unavailable" };

  let privateStateCompleted = true;
  try {
    await dependencies.store.complete({
      authUserId,
      employeeLookupDigest: createEmployeeLookupDigest(
        normalizedEmployeeNumber,
        dependencies.employeeLookupHmacKey,
      ),
    });
  } catch {
    // The temporary state remains set, so a retry still needs the same
    // employee proof. Never disclose which private check rejected it.
    privateStateCompleted = false;
  }

  // A changed auth_version denies stale JWTs even if provider-wide revocation
  // is unavailable. Make the provider call as additional defense in depth.
  await client.auth.signOut({ scope: "global" });
  return privateStateCompleted
    ? { status: "completed" }
    : { status: "unavailable" };
}
