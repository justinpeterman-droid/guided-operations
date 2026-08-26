import { NextResponse, type NextRequest } from "next/server";

import { getAuthServerEnvironment } from "@/lib/env/auth-server";
import { getRuntimeEnvironment } from "@/lib/env/runtime";
import { AUTH_RATE_LIMIT_POLICY } from "@/server/auth/auth-rate-limit-policy";
import { signInWithEmployeeNumberGuarded } from "@/server/auth/guarded-employee-sign-in";
import { createAuthRequestRateLimitSubjects } from "@/server/auth/request-rate-limit-subjects";
import {
  disabledSignInEndpoint,
  handleSignInEndpoint,
} from "@/server/auth/sign-in-endpoint";
import { createServerEmployeeSignInDependencies } from "@/server/auth/server-employee-sign-in";

export const runtime = "nodejs";

export async function POST(request: NextRequest): Promise<Response> {
  const authEnvironment = getAuthServerEnvironment();
  if (!authEnvironment.AUTH_SIGN_IN_ENABLED) {
    return disabledSignInEndpoint().response;
  }

  const runtimeEnvironment = getRuntimeEnvironment();
  const subjects = createAuthRequestRateLimitSubjects(
    request.headers,
    authEnvironment.EMPLOYEE_LOOKUP_PEPPER,
  );
  const dependencies = await createServerEmployeeSignInDependencies(
    AUTH_RATE_LIMIT_POLICY,
  );
  const result = await handleSignInEndpoint(
    request,
    runtimeEnvironment.APP_ORIGIN,
    subjects,
    (signInRequest) =>
      signInWithEmployeeNumberGuarded(signInRequest, dependencies),
  );

  if (!result.deviceCookieValue) return result.response;

  const response = new NextResponse(result.response.body, result.response);
  response.cookies.set("go-auth-device", result.deviceCookieValue, {
    httpOnly: true,
    sameSite: "lax",
    secure: runtimeEnvironment.APP_ENV !== "development",
    path: "/api/auth",
    maxAge: 30 * 24 * 60 * 60,
  });
  return response;
}
