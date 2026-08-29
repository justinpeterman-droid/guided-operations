import { createHmac, timingSafeEqual } from "node:crypto";

export function deriveCsrfToken(
  sessionId: string,
  sessionSecret: string,
  key: string,
): string {
  if (key.length < 8) {
    throw new Error("CSRF HMAC key is not configured");
  }

  return createHmac("sha256", key)
    .update(sessionId, "utf8")
    .update("\u0000", "utf8")
    .update(sessionSecret, "utf8")
    .digest("base64url");
}

export function verifyCsrfToken(
  provided: string,
  sessionId: string,
  sessionSecret: string,
  key: string,
): boolean {
  const expected = deriveCsrfToken(sessionId, sessionSecret, key);
  const providedBuffer = Buffer.from(provided, "utf8");
  const expectedBuffer = Buffer.from(expected, "utf8");

  if (providedBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(providedBuffer, expectedBuffer);
}
