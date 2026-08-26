import "server-only";

import { z } from "zod";

import { GENERIC_SIGN_IN_FAILURE } from "@/features/auth/credentials";
import { isTrustedMutationRequest } from "@/server/security/request-origin";

import type { GuardedSignInRequest } from "./guarded-employee-sign-in";
import type { AuthRequestRateLimitSubjects as RequestSubjects } from "./request-rate-limit-subjects";

const signInBodySchema = z
  .object({
    employeeNumber: z.string().trim().min(1).max(80),
    passcode: z.string().min(1).max(256),
  })
  .strict();

const noStoreHeaders = { "Cache-Control": "no-store" };

export type SignInEndpointAuthenticator = (
  request: GuardedSignInRequest,
) => Promise<{ status: "signed_in" } | { status: "failed" }>;

export type SignInEndpointResult = Readonly<{
  response: Response;
  deviceCookieValue?: string;
}>;

function genericFailure(status: number): Response {
  return Response.json(
    { message: GENERIC_SIGN_IN_FAILURE },
    { status, headers: noStoreHeaders },
  );
}

export function disabledSignInEndpoint(): SignInEndpointResult {
  return {
    response: new Response(null, { status: 404, headers: noStoreHeaders }),
  };
}

/**
 * Validates the untrusted HTTP request. It intentionally exposes the same
 * failure text for invalid bodies, cross-site requests, and bad credentials.
 */
export async function handleSignInEndpoint(
  request: Request,
  applicationOrigin: string,
  subjects: RequestSubjects,
  authenticate: SignInEndpointAuthenticator,
): Promise<SignInEndpointResult> {
  if (!isTrustedMutationRequest(request, applicationOrigin)) {
    return { response: genericFailure(403) };
  }

  if (!request.headers.get("content-type")?.startsWith("application/json")) {
    return { response: genericFailure(400) };
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return { response: genericFailure(400) };
  }
  const parsed = signInBodySchema.safeParse(body);
  if (!parsed.success) return { response: genericFailure(400) };

  const result = await authenticate({ ...parsed.data, ...subjects });
  if (result.status !== "signed_in") {
    return {
      response: genericFailure(401),
      ...(subjects.deviceCookieValue
        ? { deviceCookieValue: subjects.deviceCookieValue }
        : {}),
    };
  }

  return {
    response: Response.json(
      { status: "signed_in" },
      { headers: noStoreHeaders },
    ),
    ...(subjects.deviceCookieValue
      ? { deviceCookieValue: subjects.deviceCookieValue }
      : {}),
  };
}
