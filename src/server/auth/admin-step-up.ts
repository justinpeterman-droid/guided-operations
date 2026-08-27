import "server-only";

import { createHmac, randomBytes } from "node:crypto";

/**
 * The small, reviewed set of high-impact actions that need a fresh
 * administrator credential check. Adding an action here is intentional: it
 * cannot silently inherit a general "admin mode" token.
 */
export const ADMIN_STEP_UP_PURPOSES = [
  "account.create",
  "account.reset_passcode",
  "account.unlock",
  "account.change_role",
  "account.change_shift",
  "account.disable",
  "policy.promote",
  "retention.place_legal_hold",
  "retention.release_legal_hold",
  "retention.approve_deletion",
  "retention.execute_deletion",
  "system.destructive_cleanup",
] as const;

export type AdminStepUpPurpose = (typeof ADMIN_STEP_UP_PURPOSES)[number];

export type IssuedAdminStepUp = Readonly<{
  token: string;
  tokenDigest: string;
  expiresAt: Date;
}>;

const STEP_UP_TOKEN_BYTES = 32;
const STEP_UP_LIFETIME_MS = 5 * 60_000;

function digestStepUpToken(
  token: string,
  purpose: AdminStepUpPurpose,
  key: string,
): string {
  if (!key) throw new Error("Administrator step-up key is required.");

  return createHmac("sha256", key)
    .update(purpose)
    .update("\u0000")
    .update(token)
    .digest("base64url");
}

/**
 * Produces an opaque, short-lived, purpose-bound proof. Only its keyed digest
 * is retained by the private database; the raw token is for the following
 * one-time request only and must never be logged or persisted in the browser.
 */
export function issueAdminStepUp(
  purpose: AdminStepUpPurpose,
  key: string,
  now: Date = new Date(),
): IssuedAdminStepUp {
  const token = randomBytes(STEP_UP_TOKEN_BYTES).toString("base64url");
  return {
    token,
    tokenDigest: digestStepUpToken(token, purpose, key),
    expiresAt: new Date(now.getTime() + STEP_UP_LIFETIME_MS),
  };
}

export const adminStepUpInternals = {
  digestStepUpToken,
  stepUpLifetimeMs: STEP_UP_LIFETIME_MS,
};
