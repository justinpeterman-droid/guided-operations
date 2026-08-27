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

export type ValidatedSignInInput = z.infer<typeof signInBodySchema>;

export type SignInRequestValidation =
  | Readonly<{ ok: true; input: ValidatedSignInInput }>
  | Readonly<{ ok: false; response: Response }>;

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
 * Validates the untrusted HTTP request before any database or provider
 * dependency is opened. It intentionally exposes the same failure text for
 * invalid bodies, cross-site requests, and bad credentials.
 */
export async function validateSignInEndpointRequest(
  request: Request,
  applicationOrigin: string,
): Promise<SignInRequestValidation> {
  if (!isTrustedMutationRequest(request, applicationOrigin)) {
    return { ok: false, response: genericFailure(403) };
  }

  const contentType = request.headers.get("content-type") ?? "";
  let body: unknown;
  try {
    if (contentType.startsWith("application/json")) {
      body = await request.json();
    } else if (contentType.startsWith("application/x-www-form-urlencoded")) {
      const form = await request.formData();
      body = {
        employeeNumber: form.get("employeeNumber"),
        passcode: form.get("passcode"),
      };
    } else {
      return { ok: false, response: genericFailure(400) };
    }
  } catch {
    return { ok: false, response: genericFailure(400) };
  }
  const parsed = signInBodySchema.safeParse(body);
  if (!parsed.success) return { ok: false, response: genericFailure(400) };

  return { ok: true, input: parsed.data };
}

export async function authenticateValidatedSignInRequest(
  input: ValidatedSignInInput,
  subjects: RequestSubjects,
  authenticate: SignInEndpointAuthenticator,
): Promise<SignInEndpointResult> {
  const result = await authenticate({ ...input, ...subjects });

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

export async function handleSignInEndpoint(
  request: Request,
  applicationOrigin: string,
  subjects: RequestSubjects,
  authenticate: SignInEndpointAuthenticator,
): Promise<SignInEndpointResult> {
  const validation = await validateSignInEndpointRequest(
    request,
    applicationOrigin,
  );
  if (!validation.ok) return { response: validation.response };

  return authenticateValidatedSignInRequest(
    validation.input,
    subjects,
    authenticate,
  );
}
