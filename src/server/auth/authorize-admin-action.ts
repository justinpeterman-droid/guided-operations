import "server-only";

import { z } from "zod";

import { adminStepUpInternals, type AdminStepUpPurpose } from "./admin-step-up";
import type { AdminStepUpStore } from "./private-admin-step-up-store";

const proofSchema = z
  .object({
    requestId: z.string().uuid(),
    token: z.string().min(32).max(256),
  })
  .strict();

export type AdminActionAuthorization = Readonly<{
  consume(): Promise<Readonly<{ actorAuthUserId: string }> | null>;
}>;

/** Turns a purpose-bound proof into one single-use private admin action. */
export function createAdminActionAuthorization(
  purpose: AdminStepUpPurpose,
  input: unknown,
  currentSession: Readonly<{
    authUserId: string;
    sessionId: string;
    authVersion: number;
  }>,
  dependencies: Readonly<{ store: AdminStepUpStore; hmacKey: string }>,
): AdminActionAuthorization {
  const proof = proofSchema.safeParse(input);

  return {
    async consume() {
      if (!proof.success) return null;
      try {
        const consumed = await dependencies.store.consume({
          authUserId: currentSession.authUserId,
          sessionId: currentSession.sessionId,
          authVersion: currentSession.authVersion,
          purpose,
          requestId: proof.data.requestId,
          tokenDigest: adminStepUpInternals.digestStepUpToken(
            proof.data.token,
            purpose,
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
