import "server-only";

import { randomUUID } from "node:crypto";
import { z } from "zod";

import { issueAdminStepUp, type AdminStepUpPurpose } from "./admin-step-up";
import {
  authorizeCurrentSession,
  type CurrentSessionClient,
} from "./current-session";
import type { AdminStepUpStore } from "./private-admin-step-up-store";

const inputSchema = z.object({ passcode: z.string().min(1).max(256) }).strict();

export type AdministratorPasscodeVerifier = Readonly<{
  verify(authUserId: string, passcode: string): Promise<boolean>;
}>;

export type RequestAdminStepUpDependencies = Readonly<{
  verifier: AdministratorPasscodeVerifier;
  store: AdminStepUpStore;
  hmacKey: string;
  now?: () => Date;
}>;

export type RequestAdminStepUpResult =
  | Readonly<{ status: "issued"; token: string; requestId: string }>
  | Readonly<{ status: "denied" }>
  | Readonly<{ status: "invalid_input" }>
  | Readonly<{ status: "unavailable" }>;

/** Rechecks an administrator passcode and issues a one-time proof for one action. */
export async function requestAdminStepUp(
  client: CurrentSessionClient,
  purpose: AdminStepUpPurpose,
  input: unknown,
  dependencies: RequestAdminStepUpDependencies,
): Promise<RequestAdminStepUpResult> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return { status: "invalid_input" };
  const session = await authorizeCurrentSession(client, {
    requiredRole: "administrator",
  });
  if (!session.allowed) return { status: "denied" };
  if (
    !(await dependencies.verifier.verify(
      session.account.authUserId,
      parsed.data.passcode,
    ))
  ) {
    return { status: "denied" };
  }
  try {
    const now = dependencies.now?.() ?? new Date();
    const proof = issueAdminStepUp(purpose, dependencies.hmacKey, now);
    const requestId = randomUUID();
    await dependencies.store.issue({
      authUserId: session.account.authUserId,
      sessionId: session.sessionId,
      authVersion: session.account.authVersion,
      purpose,
      tokenDigest: proof.tokenDigest,
      requestId,
      expiresAt: proof.expiresAt,
    });
    return { status: "issued", token: proof.token, requestId };
  } catch {
    return { status: "unavailable" };
  }
}
