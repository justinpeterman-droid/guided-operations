import { NextResponse } from "next/server";

import { getAuthServerEnvironment } from "@/lib/env/auth-server";
import { getRuntimeEnvironment } from "@/lib/env/runtime";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { completeTemporaryPasscodeChange } from "@/server/auth/complete-temporary-passcode-change";
import { authorizeCurrentSession } from "@/server/auth/current-session";
import { createTemporaryPasscodeChangeStore } from "@/server/auth/private-passcode-change-store";
import { isTrustedMutationRequest } from "@/server/security/request-origin";
import {
  CSRF_DIGEST_COOKIE,
  CSRF_TOKEN_COOKIE,
  hasValidSessionCsrfRequest,
} from "@/server/security/session-csrf";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const NO_STORE_HEADERS = { "Cache-Control": "private, no-store" };

/** Completes only an already-authorized, forced temporary-passcode session. */
export async function POST(request: Request): Promise<Response> {
  try {
    const [environment, runtimeEnvironment, client] = await Promise.all([
      getAuthServerEnvironment(),
      getRuntimeEnvironment(),
      createSupabaseServerClient(),
    ]);
    const session = await authorizeCurrentSession(client, {
      allowForcedPasscodeChange: true,
    });
    if (!session.allowed || !session.account.mustChangePasscode) {
      return authenticationRequired();
    }

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

    const input: unknown = await request.json();
    const result = await completeTemporaryPasscodeChange(
      input,
      session.account.authUserId,
      client,
      {
        employeeLookupHmacKey: environment.EMPLOYEE_LOOKUP_PEPPER,
        store: createTemporaryPasscodeChangeStore(),
      },
    );
    if (result.status === "invalid_input") return invalidInput();
    if (result.status !== "completed") return unavailable();

    const response = NextResponse.json(
      { data: { status: "passcode_changed" } },
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

function invalidInput(): Response {
  return NextResponse.json(
    { error: "invalid_passcode" },
    { status: 400, headers: NO_STORE_HEADERS },
  );
}

function unavailable(): Response {
  return NextResponse.json(
    { error: "service_unavailable" },
    { status: 503, headers: NO_STORE_HEADERS },
  );
}
