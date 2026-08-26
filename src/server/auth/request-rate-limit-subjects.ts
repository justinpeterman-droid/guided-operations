import "server-only";

import { randomBytes } from "node:crypto";

import { createAuthAttemptSubjectDigest } from "./guarded-employee-sign-in";

export const AUTH_DEVICE_COOKIE_NAME = "go-auth-device";

export type AuthRequestRateLimitSubjects = Readonly<{
  deviceDigest: string;
  networkDigest: string;
  globalDigest: string;
  /** Set this only on a response; the raw device value is never persisted. */
  deviceCookieValue?: string;
}>;

type RequestHeaders = Pick<Headers, "get">;

function existingDeviceCookie(cookieHeader: string | null): string | undefined {
  if (!cookieHeader) return undefined;

  const prefix = `${AUTH_DEVICE_COOKIE_NAME}=`;
  for (const part of cookieHeader.split(";")) {
    const candidate = part.trim();
    if (candidate.startsWith(prefix)) {
      const value = candidate.slice(prefix.length);
      if (/^[A-Za-z0-9_-]{32,128}$/.test(value)) return value;
    }
  }
  return undefined;
}

/**
 * Builds opaque pre-auth rate-limit identifiers. Vercel sets
 * x-vercel-forwarded-for for direct requests; when it is unavailable, the
 * network dimension intentionally degrades to one shared opaque subject while
 * device and global controls remain in force.
 */
export function createAuthRequestRateLimitSubjects(
  headers: RequestHeaders,
  hmacKey: string,
): AuthRequestRateLimitSubjects {
  const deviceCookie = existingDeviceCookie(headers.get("cookie"));
  const deviceValue = deviceCookie ?? randomBytes(32).toString("base64url");
  const networkValue =
    headers.get("x-vercel-forwarded-for")?.trim() || "unavailable";

  return {
    deviceDigest: createAuthAttemptSubjectDigest(
      "device",
      deviceValue,
      hmacKey,
    ),
    networkDigest: createAuthAttemptSubjectDigest(
      "network",
      networkValue,
      hmacKey,
    ),
    globalDigest: createAuthAttemptSubjectDigest(
      "global",
      "all-sign-in-attempts",
      hmacKey,
    ),
    ...(deviceCookie ? {} : { deviceCookieValue: deviceValue }),
  };
}
