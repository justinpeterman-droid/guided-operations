import "server-only";

import { z } from "zod";

import {
  normalizeEmployeeNumber,
  validatePasscode,
} from "@/features/auth/credentials";

import { createEmployeeLookupDigest } from "./employee-sign-in";
import type { PersonalPasscodeChangeStore } from "./personal-passcode-change-store";

const inputSchema = z
  .object({
    employeeNumber: z.string().min(1).max(128),
    currentPasscode: z.string().min(1).max(256),
    newPasscode: z.string().min(1).max(256),
  })
  .strict();

export type AccountPasscodeVerifier = Readonly<{
  verify(authUserId: string, passcode: string): Promise<boolean>;
}>;

export type AccountPasswordUpdater = Readonly<{
  updatePassword(authUserId: string, passcode: string): Promise<boolean>;
}>;

export type GlobalSignOutClient = Readonly<{
  auth: Readonly<{
    signOut(
      input: Readonly<{ scope: "global" }>,
    ): Promise<Readonly<{ error: unknown | null }>>;
  }>;
}>;

/** Replaces a signed-in person's passcode and revokes every existing session. */
export async function changePersonalPasscode(
  input: unknown,
  authUserId: string,
  client: GlobalSignOutClient,
  dependencies: Readonly<{
    employeeLookupHmacKey: string;
    verifier: AccountPasscodeVerifier;
    updater: AccountPasswordUpdater;
    store: PersonalPasscodeChangeStore;
  }>,
): Promise<"changed" | "invalid_input" | "failed"> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return "invalid_input";
  const normalizedEmployeeNumber = normalizeEmployeeNumber(
    parsed.data.employeeNumber,
  );
  if (
    parsed.data.currentPasscode === parsed.data.newPasscode ||
    !validatePasscode(parsed.data.newPasscode, normalizedEmployeeNumber).valid
  )
    return "invalid_input";

  const employeeLookupDigest = createEmployeeLookupDigest(
    normalizedEmployeeNumber,
    dependencies.employeeLookupHmacKey,
  );
  try {
    const [currentPasscodeAccepted, identityAccepted] = await Promise.all([
      dependencies.verifier.verify(authUserId, parsed.data.currentPasscode),
      dependencies.store.verifyIdentity(authUserId, employeeLookupDigest),
    ]);
    if (!currentPasscodeAccepted || !identityAccepted) return "invalid_input";
    await dependencies.store.prepare(authUserId, employeeLookupDigest);

    let passwordUpdated = false;
    try {
      passwordUpdated = await dependencies.updater.updatePassword(
        authUserId,
        parsed.data.newPasscode,
      );
    } catch {
      // Provider-wide sign-out is still attempted below. The database keeps
      // token issuance fail closed during its bounded reconciliation window.
    }

    let providerRevoked = false;
    try {
      const { error } = await client.auth.signOut({ scope: "global" });
      providerRevoked = error === null;
    } catch {
      // Do not seal or claim success when provider revocation is unavailable.
    }
    if (!passwordUpdated || !providerRevoked) return "failed";

    await dependencies.store.record(authUserId, employeeLookupDigest);
    return "changed";
  } catch {
    return "failed";
  }
}
