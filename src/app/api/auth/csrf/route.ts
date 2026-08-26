import { NextResponse } from "next/server";

import { getAuthServerEnvironment } from "@/lib/env/auth-server";
import { getRuntimeEnvironment } from "@/lib/env/runtime";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { issueCsrfForCurrentSession } from "@/server/security/csrf-endpoint";
import {
  CSRF_DIGEST_COOKIE,
  CSRF_TOKEN_COOKIE,
} from "@/server/security/session-csrf";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const NO_STORE_HEADERS = { "Cache-Control": "no-store" };
const CSRF_MAX_AGE_SECONDS = 30 * 60;

/**
 * Returns a fresh CSRF token only to an authenticated, currently authorized
 * session. The digest remains HTTP-only and cannot be reused by another
 * session.
 */
export async function GET(): Promise<Response> {
  try {
    const [authEnvironment, runtimeEnvironment, client] = await Promise.all([
      getAuthServerEnvironment(),
      getRuntimeEnvironment(),
      createSupabaseServerClient(),
    ]);
    const result = await issueCsrfForCurrentSession(
      client,
      authEnvironment.CSRF_HMAC_KEY,
    );
    if (result.kind !== "issued") return unauthorizedResponse();

    const response = NextResponse.json(
      { csrfToken: result.token.token },
      { headers: NO_STORE_HEADERS },
    );
    const secure = runtimeEnvironment.APP_ENV !== "development";

    response.cookies.set(CSRF_TOKEN_COOKIE, result.token.token, {
      httpOnly: false,
      sameSite: "strict",
      secure,
      path: "/",
      maxAge: CSRF_MAX_AGE_SECONDS,
    });
    response.cookies.set(CSRF_DIGEST_COOKIE, result.token.digest, {
      httpOnly: true,
      sameSite: "strict",
      secure,
      path: "/",
      maxAge: CSRF_MAX_AGE_SECONDS,
    });
    return response;
  } catch {
    return unavailableResponse();
  }
}

function unauthorizedResponse(): Response {
  return NextResponse.json(
    { error: "authentication_required" },
    { status: 401, headers: NO_STORE_HEADERS },
  );
}

function unavailableResponse(): Response {
  return NextResponse.json(
    { error: "service_unavailable" },
    { status: 503, headers: NO_STORE_HEADERS },
  );
}
