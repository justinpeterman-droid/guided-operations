import "server-only";

import { z } from "zod";

import { adminStepUpInternals } from "./admin-step-up";
import type { AdminInviteAuthorization } from "./invite-account";
import type { AdminStepUpStore } from "./private-admin-step-up-store";

const proofSchema = z
  .object({
    requestId: z.string().uuid(),
    token: z.string().min(32).max(256),
  })
  .strict();

/** Turns one validated account-create proof into the one-use invite authority. */
export function createAdminInviteAuthorization(
  input: unknown,
  currentSession: Readonly<{
    authUserId: string;
    sessionId: string;
    authVersion: number;
  }>,
  dependencies: Readonly<{ store: AdminStepUpStore; hmacKey: string }>,
): AdminInviteAuthorization {
  const proof = proofSchema.safeParse(input);

  return {
    async consume() {
      if (!proof.success) return null;
      try {
        const consumed = await dependencies.store.consume({
          authUserId: currentSession.authUserId,
          sessionId: currentSession.sessionId,
          authVersion: currentSession.authVersion,
          purpose: "account.create",
          requestId: proof.data.requestId,
          tokenDigest: adminStepUpInternals.digestStepUpToken(
            proof.data.token,
            "account.create",
            dependencies.hmacKey,
          ),
        });
        return consumed ? { actorAuthUserId: currentSession.authUserId } : null;
      } catch {
        return null;
      }
    },
  };
}
