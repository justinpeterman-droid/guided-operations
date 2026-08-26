import { randomUUID } from "node:crypto";

import { NextResponse, type NextRequest } from "next/server";

import { getAuthServerEnvironment } from "@/lib/env/auth-server";
import { getRuntimeEnvironment } from "@/lib/env/runtime";
import { AUTH_RATE_LIMIT_POLICY } from "@/server/auth/auth-rate-limit-policy";
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

export const runtime = "nodejs";

export async function POST(request: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  const startedAt = Date.now();
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
    return observedResponse(validation.response, {
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
  const dependencies = await createServerEmployeeSignInDependencies(
    AUTH_RATE_LIMIT_POLICY,
  );
  const result = await authenticateValidatedSignInRequest(
    validation.input,
    subjects,
    (signInRequest) =>
      signInWithEmployeeNumberGuarded(signInRequest, dependencies),
  );

  if (!result.deviceCookieValue) {
    return observedSignInResult(
      result.response,
      requestId,
      startedAt,
      runtimeEnvironment.APP_ENV,
    );
  }

  const response = new NextResponse(result.response.body, result.response);
  response.cookies.set("go-auth-device", result.deviceCookieValue, {
    httpOnly: true,
    sameSite: "lax",
    secure: runtimeEnvironment.APP_ENV !== "development",
    path: "/api/auth",
    maxAge: 30 * 24 * 60 * 60,
  });
  return observedSignInResult(
    response,
    requestId,
    startedAt,
    runtimeEnvironment.APP_ENV,
  );
}

function observedSignInResult(
  response: Response,
  requestId: string,
  startedAt: number,
  environment: SafeOperationalEventInput["environment"],
): Response {
  return observedResponse(response, {
    event_name: "auth.sign_in",
    outcome: response.status === 200 ? "signed_in" : "sign_in_failed",
    request_id: requestId,
    status_code: response.status,
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
