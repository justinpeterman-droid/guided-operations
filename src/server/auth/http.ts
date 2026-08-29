import { randomUUID } from "node:crypto";

export const SESSION_COOKIE_NAME = "go_session";
export const DEVICE_COOKIE_NAME = "go_device";

const UUID_V4_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SESSION_MAX_AGE_SECONDS = 12 * 60 * 60;
const DEVICE_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

export interface CookieStoreLike {
  get(name: string): { value: string } | undefined;
  set(
    name: string,
    value: string,
    options: {
      httpOnly: boolean;
      secure: boolean;
      sameSite: "lax";
      path: string;
      maxAge: number;
    },
  ): void;
}

export interface HeadersLike {
  get(name: string): string | null;
}

export function getOrCreateDeviceId(
  cookies: CookieStoreLike,
  secure: boolean,
): string {
  const existing = cookies.get(DEVICE_COOKIE_NAME)?.value;
  if (existing && UUID_V4_PATTERN.test(existing)) {
    return existing.toLowerCase();
  }

  const value = randomUUID();
  cookies.set(DEVICE_COOKIE_NAME, value, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: DEVICE_MAX_AGE_SECONDS,
  });
  return value;
}

export function setSessionCookie(
  cookies: CookieStoreLike,
  sessionToken: string,
  secure: boolean,
): void {
  cookies.set(SESSION_COOKIE_NAME, sessionToken, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export function clearSessionCookie(
  cookies: CookieStoreLike,
  secure: boolean,
): void {
  cookies.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export function networkIdentifierFromHeaders(headers: HeadersLike): string {
  const vercelForwardedFor = headers.get("x-vercel-forwarded-for");
  if (vercelForwardedFor) {
    return firstForwardedAddress(vercelForwardedFor);
  }

  if (process.env.VERCEL !== "1") {
    const localForwardedFor = headers.get("x-forwarded-for");
    if (localForwardedFor) {
      return firstForwardedAddress(localForwardedFor);
    }
  }

  return "unknown-network";
}

function firstForwardedAddress(value: string): string {
  return value.split(",", 1)[0]?.trim().slice(0, 128) || "unknown-network";
}
