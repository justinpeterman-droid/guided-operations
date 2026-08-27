import { type NextRequest, NextResponse } from "next/server";

import { getAuthSessionEnvironment } from "@/lib/env/auth-session";
import { getRuntimeEnvironment } from "@/lib/env/runtime";
import { getPublicSupabaseEnvironment } from "@/lib/env/supabase-public";
import {
  createEncryptedSupabaseSessionStorage,
  type SessionCookieChange,
} from "@/server/auth/encrypted-supabase-session-storage";
import { parseSessionAuthority } from "@/server/auth/session-claims";
import {
  CSRF_DIGEST_COOKIE,
  CSRF_TOKEN_COOKIE,
  issueSessionCsrfToken,
} from "@/server/security/session-csrf";
import { getAuthServerEnvironment } from "@/lib/env/auth-server";

import { createSupabaseSessionClient } from "./session-client";

/**
 * Refreshes verified Supabase Auth claims at the request boundary. Server
 * Components receive the refreshed request cookies and the browser receives
 * matching response cookies. Callers must still recheck app_private account
 * status and auth_version before authorizing an operation.
 */
export async function refreshSupabaseSession(request: NextRequest) {
  const environment = getPublicSupabaseEnvironment();
  const authSessionEnvironment = getAuthSessionEnvironment();
  const runtimeEnvironment = getRuntimeEnvironment();
  let response = nextResponseWithRequestHeaders(request);
  const pendingChanges = new Map<string, SessionCookieChange>();

  const storage = createEncryptedSupabaseSessionStorage({
    encryptionKey: authSessionEnvironment.AUTH_SESSION_ENCRYPTION_KEY,
    secure:
      runtimeEnvironment.APP_ENV !== "development" &&
      runtimeEnvironment.APP_ENV !== "test",
    cookies: {
      readAll: () => request.cookies.getAll(),
      writeAll: (changes) => {
        for (const change of changes) {
          if (change.options.maxAge === 0) {
            request.cookies.delete(change.name);
          } else {
            request.cookies.set(change.name, change.value);
          }
          pendingChanges.set(change.name, change);
        }

        response = nextResponseWithRequestHeaders(request);
        for (const { name, value, options } of pendingChanges.values()) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  const supabase = createSupabaseSessionClient(
    environment.NEXT_PUBLIC_SUPABASE_URL,
    environment.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    storage,
  );

  const claimsResult = await supabase.auth.getClaims();
  const authority = parseSessionAuthority(claimsResult.data?.claims);
  if (
    request.method === "GET" &&
    request.nextUrl.pathname === "/account" &&
    authority
  ) {
    const authEnvironment = getAuthServerEnvironment();
    const token = issueSessionCsrfToken(
      authority.sessionId,
      authEnvironment.CSRF_HMAC_KEY,
    );
    const secure = runtimeEnvironment.APP_ENV !== "development";
    request.cookies.set(CSRF_TOKEN_COOKIE, token.token);
    request.cookies.set(CSRF_DIGEST_COOKIE, token.digest);
    response = nextResponseWithRequestHeaders(request);
    for (const { name, value, options } of pendingChanges.values()) {
      response.cookies.set(name, value, options);
    }
    response.cookies.set(CSRF_TOKEN_COOKIE, token.token, {
      httpOnly: false,
      sameSite: "strict",
      secure,
      path: "/",
      maxAge: 30 * 60,
    });
    response.cookies.set(CSRF_DIGEST_COOKIE, token.digest, {
      httpOnly: true,
      sameSite: "strict",
      secure,
      path: "/",
      maxAge: 30 * 60,
    });
  }
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Expires", "0");
  return response;
}

function nextResponseWithRequestHeaders(request: NextRequest): NextResponse {
  return NextResponse.next({
    request: { headers: new Headers(request.headers) },
  });
}
