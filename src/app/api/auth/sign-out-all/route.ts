import { NextResponse } from "next/server";

import { getAuthServerEnvironment } from "@/lib/env/auth-server";
import { getRuntimeEnvironment } from "@/lib/env/runtime";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { authorizeCurrentSession } from "@/server/auth/current-session";
import { createPersonalSessionRevocationStore } from "@/server/auth/personal-session-revocation-store";
import { isTrustedMutationRequest } from "@/server/security/request-origin";
import {
  CSRF_DIGEST_COOKIE,
  CSRF_TOKEN_COOKIE,
  hasValidSessionCsrfRequest,
} from "@/server/security/session-csrf";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const NO_STORE_HEADERS = { "Cache-Control": "private, no-store" };

/**
 * Advances application session authority and revokes provider refresh sessions
 * only after proving the current session, exact origin, and session-bound CSRF.
 */
export async function POST(request: Request): Promise<Response> {
  try {
    const [environment, runtimeEnvironment, client] = await Promise.all([
      getAuthServerEnvironment(),
      getRuntimeEnvironment(),
      createSupabaseServerClient(),
    ]);
    const session = await authorizeCurrentSession(client);
    if (!session.allowed) return authenticationRequired();

    if (
      !isTrustedMutationRequest(request, runtimeEnvironment.APP_ORIGIN) ||
      !hasValidSessionCsrfRequest(
        request.headers,
        session.sessionId,
        environment.CSRF_HMAC_KEY,
      )
    ) {
      return requestNotAllowed();
    }

    const revocationStore = createPersonalSessionRevocationStore();
    const intermediateAuthVersion = await revocationStore.beginAll(
      session.account.authUserId,
      session.account.authVersion,
    );
    const { error } = await client.auth.signOut({ scope: "global" });
    if (error) return unavailable();
    await revocationStore.completeAll(
      session.account.authUserId,
      intermediateAuthVersion,
    );

    const response = NextResponse.json(
      { data: { status: "signed_out_everywhere" } },
      { headers: NO_STORE_HEADERS },
    );
    response.cookies.delete(CSRF_TOKEN_COOKIE);
    response.cookies.delete(CSRF_DIGEST_COOKIE);
    response.cookies.delete("go-auth-device");
    return response;
  } catch {
    return unavailable();
  }
}

function authenticationRequired(): Response {
  return NextResponse.json(
    { error: "authentication_required" },
    { status: 401, headers: NO_STORE_HEADERS },
  );
}

function requestNotAllowed(): Response {
  return NextResponse.json(
    { error: "request_not_allowed" },
    { status: 403, headers: NO_STORE_HEADERS },
  );
}

function unavailable(): Response {
  return NextResponse.json(
    { error: "service_unavailable" },
    { status: 503, headers: NO_STORE_HEADERS },
  );
}
