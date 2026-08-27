import { randomUUID } from "node:crypto";

import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";

import { getAuthServerEnvironment } from "@/lib/env/auth-server";
import { getRuntimeEnvironment } from "@/lib/env/runtime";
import { AUTH_RATE_LIMIT_POLICY } from "@/server/auth/auth-rate-limit-policy";
import { createSupabasePasswordAuthenticatorForCookieIo } from "@/server/auth/supabase-auth-adapters";
import { signInWithEmployeeNumberGuarded } from "@/server/auth/guarded-employee-sign-in";
import { createAuthRequestRateLimitSubjects } from "@/server/auth/request-rate-limit-subjects";
import {
  authenticateValidatedSignInRequest,
  disabledSignInEndpoint,
  validateSignInEndpointRequest,
} from "@/server/auth/sign-in-endpoint";
import { createServerEmployeeSignInDependencies } from "@/server/auth/server-employee-sign-in";
import {
  writeSafeOperationalEvent,
  type SafeOperationalEventInput,
} from "@/server/observability/safe-operational-event";
import type {
  SessionCookieChange,
  SessionCookieIo,
} from "@/server/auth/encrypted-supabase-session-storage";

export const runtime = "nodejs";

export async function POST(request: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  const startedAt = Date.now();
  const isNativeFormSubmission = request.headers
    .get("content-type")
    ?.startsWith("application/x-www-form-urlencoded");
  const authEnvironment = getAuthServerEnvironment();
  if (!authEnvironment.AUTH_SIGN_IN_ENABLED) {
    return disabledSignInEndpoint().response;
  }

  const runtimeEnvironment = getRuntimeEnvironment();
  const validation = await validateSignInEndpointRequest(
    request,
    runtimeEnvironment.APP_ORIGIN,
  );
  if (!validation.ok) {
    const response = isNativeFormSubmission
      ? loginRedirect(runtimeEnvironment.APP_ORIGIN, false)
      : validation.response;
    return observedResponse(response, {
      event_name: "auth.sign_in",
      outcome: "validation_rejected",
      request_id: requestId,
      status_code: validation.response.status,
      duration_ms: boundedDuration(startedAt),
      environment: runtimeEnvironment.APP_ENV,
    });
  }

  const subjects = createAuthRequestRateLimitSubjects(
    request.headers,
    authEnvironment.EMPLOYEE_LOOKUP_PEPPER,
  );
  const sessionCookieCapture = createSessionCookieCapture(
    (await cookies()).getAll(),
  );
  const dependencies = await createServerEmployeeSignInDependencies(
    AUTH_RATE_LIMIT_POLICY,
    createSupabasePasswordAuthenticatorForCookieIo(
      sessionCookieCapture.cookies,
    ),
  );
  const result = await authenticateValidatedSignInRequest(
    validation.input,
    subjects,
    (signInRequest) =>
      signInWithEmployeeNumberGuarded(signInRequest, dependencies),
  );

  const resultResponse = isNativeFormSubmission
    ? loginRedirect(
        runtimeEnvironment.APP_ORIGIN,
        result.response.status === 200,
      )
    : result.response;

  const response = new NextResponse(resultResponse.body, resultResponse);
  sessionCookieCapture.apply(response);
  if (result.deviceCookieValue) {
    response.cookies.set("go-auth-device", result.deviceCookieValue, {
      httpOnly: true,
      sameSite: "lax",
      secure: runtimeEnvironment.APP_ENV !== "development",
      path: "/api/auth",
      maxAge: 30 * 24 * 60 * 60,
    });
  }
  return observedSignInResult(
    response,
    requestId,
    startedAt,
    runtimeEnvironment.APP_ENV,
    result.response.status,
  );
}

/**
 * The encrypted session storage writes through Next's request cookie store.
 * A native form redirect has its own response, so copy only the opaque session
 * cookies onto that response before the browser follows it.
 */
function createSessionCookieCapture(
  initialCookies: ReadonlyArray<Readonly<{ name: string; value: string }>>,
) {
  let currentCookies = [...initialCookies];
  const pendingChanges = new Map<string, SessionCookieChange>();
  const cookies: SessionCookieIo = {
    readAll: () => currentCookies,
    writeAll: (changes) => {
      const pendingByName = new Map(
        changes.map((change) => [change.name, change]),
      );
      currentCookies = currentCookies.filter(
        (cookie) => !pendingByName.has(cookie.name),
      );
      for (const change of changes) {
        if (change.options.maxAge !== 0) {
          currentCookies.push({ name: change.name, value: change.value });
        }
        pendingChanges.set(change.name, change);
      }
    },
  };
  return {
    cookies,
    apply(response: NextResponse) {
      for (const { name, value, options } of pendingChanges.values()) {
        response.cookies.set(name, value, options);
      }
    },
  };
}

function loginRedirect(
  applicationOrigin: string,
  signedIn: boolean,
): NextResponse {
  return NextResponse.redirect(
    new URL(signedIn ? "/home" : "/login?error=sign-in", applicationOrigin),
    { status: 303 },
  );
}

function observedSignInResult(
  response: Response,
  requestId: string,
  startedAt: number,
  environment: SafeOperationalEventInput["environment"],
  authenticationStatus = response.status,
): Response {
  return observedResponse(response, {
    event_name: "auth.sign_in",
    outcome: authenticationStatus === 200 ? "signed_in" : "sign_in_failed",
    request_id: requestId,
    status_code: authenticationStatus,
    duration_ms: boundedDuration(startedAt),
    environment,
  });
}

function boundedDuration(startedAt: number): number {
  return Math.min(3_600_000, Math.max(0, Date.now() - startedAt));
}

function observedResponse(
  response: Response,
  event: SafeOperationalEventInput,
): Response {
  writeSafeOperationalEvent(event);
  return response;
}
