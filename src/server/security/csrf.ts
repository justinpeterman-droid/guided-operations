import "server-only";

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const TOKEN_BYTES = 32;

function tokenDigest(
  token: string,
  sessionId: string,
  hmacKey: string,
): Buffer {
  if (!sessionId || !hmacKey) {
    throw new Error(
      "CSRF verification requires a session identifier and HMAC key",
    );
  }

  return createHmac("sha256", hmacKey)
    .update(sessionId)
    .update("\u0000")
    .update(token)
    .digest();
}

/** Generates an opaque browser value; retain only its session-bound digest. */
export function createCsrfToken(): string {
  return randomBytes(TOKEN_BYTES).toString("base64url");
}

export function createCsrfTokenDigest(
  token: string,
  sessionId: string,
  hmacKey: string,
): string {
  return tokenDigest(token, sessionId, hmacKey).toString("base64url");
}

/**
 * Compares fixed-size HMAC digests, binding a token to the current session so
 * a value copied from a different session cannot authorize a mutation.
 */
export function hasValidCsrfToken(
  submittedToken: string | null,
  expectedDigest: string | null,
  sessionId: string,
  hmacKey: string,
): boolean {
  if (!submittedToken || !expectedDigest) return false;

  try {
    const expected = Buffer.from(expectedDigest, "base64url");
    const actual = tokenDigest(submittedToken, sessionId, hmacKey);

    return (
      expected.length === actual.length && timingSafeEqual(expected, actual)
    );
  } catch {
    return false;
  }
}
