import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

import { getAuthServerEnvironment } from "@/lib/env/auth-server";
import { getRuntimeEnvironment } from "@/lib/env/runtime";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { changePersonalPasscode } from "@/server/auth/change-personal-passcode";
import { authorizeCurrentSession } from "@/server/auth/current-session";
import { createPersonalPasscodeChangeStore } from "@/server/auth/personal-passcode-change-store";
import {
  createSupabaseAccountPasscodeVerifier,
  createSupabaseAuthPasswordResetter,
} from "@/server/auth/supabase-auth-adapters";
import { isTrustedMutationRequest } from "@/server/security/request-origin";
import {
  boundedOperationalDuration,
  observedResponse,
} from "@/server/observability/observed-response";
import type { SafeOperationalEventInput } from "@/server/observability/safe-operational-event";
import {
  CSRF_DIGEST_COOKIE,
  CSRF_TOKEN_COOKIE,
  hasValidSessionCsrfRequest,
} from "@/server/security/session-csrf";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const headers = { "Cache-Control": "private, no-store" };

/** Changes the current account's personal passcode after fresh verification. */
export async function POST(request: Request): Promise<Response> {
  const requestId = randomUUID();
  const startedAt = Date.now();
  let appEnvironment: SafeOperationalEventInput["environment"] = "test";
  const observe = (
    response: Response,
    outcome: SafeOperationalEventInput["outcome"],
  ) =>
    observedResponse(response, {
      event_name: "auth.passcode_change",
      outcome,
      request_id: requestId,
      status_code: response.status,
      duration_ms: boundedOperationalDuration(startedAt),
      environment: appEnvironment,
    });

  try {
    const [environment, runtimeEnvironment, client] = await Promise.all([
      getAuthServerEnvironment(),
      getRuntimeEnvironment(),
      createSupabaseServerClient(),
    ]);
    appEnvironment = runtimeEnvironment.APP_ENV;
    const session = await authorizeCurrentSession(client);
    if (!session.allowed)
      return observe(authenticationRequired(), "authentication_required");
    if (
      !isTrustedMutationRequest(request, runtimeEnvironment.APP_ORIGIN) ||
      !hasValidSessionCsrfRequest(
        request.headers,
        session.sessionId,
        environment.CSRF_HMAC_KEY,
      )
    )
      return observe(requestNotAllowed(), "request_not_allowed");

    const result = await changePersonalPasscode(
      await request.json(),
      session.account.authUserId,
      client,
      {
        employeeLookupHmacKey: environment.EMPLOYEE_LOOKUP_PEPPER,
        verifier: createSupabaseAccountPasscodeVerifier(),
        updater: createSupabaseAuthPasswordResetter(),
        store: createPersonalPasscodeChangeStore(),
      },
    );
    if (result === "invalid_input")
      return observe(invalidInput(), "validation_rejected");
    if (result !== "changed")
      return observe(unavailable(), "service_unavailable");

    const response = NextResponse.json(
      { data: { status: "passcode_changed" } },
      { headers },
    );
    response.cookies.delete(CSRF_TOKEN_COOKIE);
    response.cookies.delete(CSRF_DIGEST_COOKIE);
    response.cookies.delete("go-auth-device");
    return observe(response, "changed");
  } catch {
    return observe(unavailable(), "service_unavailable");
  }
}

function authenticationRequired() {
  return NextResponse.json(
    { error: "authentication_required" },
    { status: 401, headers },
  );
}

function requestNotAllowed() {
  return NextResponse.json(
    { error: "request_not_allowed" },
    { status: 403, headers },
  );
}

function invalidInput() {
  return NextResponse.json(
    { error: "invalid_passcode" },
    { status: 400, headers },
  );
}

function unavailable() {
  return NextResponse.json(
    { error: "service_unavailable" },
    { status: 503, headers },
  );
}
