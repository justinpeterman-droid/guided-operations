import "server-only";

import {
  createCsrfToken,
  createCsrfTokenDigest,
  hasValidCsrfToken,
} from "./csrf";

export const CSRF_TOKEN_COOKIE = "go-csrf";
export const CSRF_DIGEST_COOKIE = "go-csrf-digest";
export const CSRF_HEADER = "x-csrf-token";

type RequestHeaders = Pick<Headers, "get">;

export type IssuedCsrfToken = Readonly<{
  token: string;
  digest: string;
}>;

function findCookie(cookieHeader: string | null, name: string): string | null {
  if (!cookieHeader) return null;

  const prefix = `${name}=`;
  for (const part of cookieHeader.split(";")) {
    const trimmed = part.trim();
    if (trimmed.startsWith(prefix)) return trimmed.slice(prefix.length);
  }
  return null;
}

/** Issues a fresh browser token and a server-verifiable session-bound digest. */
export function issueSessionCsrfToken(
  sessionId: string,
  hmacKey: string,
): IssuedCsrfToken {
  const token = createCsrfToken();
  return { token, digest: createCsrfTokenDigest(token, sessionId, hmacKey) };
}

/** Validates a double-submit token without ever returning cookie values. */
export function hasValidSessionCsrfRequest(
  headers: RequestHeaders,
  sessionId: string,
  hmacKey: string,
): boolean {
  return hasValidCsrfToken(
    headers.get(CSRF_HEADER),
    findCookie(headers.get("cookie"), CSRF_DIGEST_COOKIE),
    sessionId,
    hmacKey,
  );
}
