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
  hasValidSessionCsrfToken,
  readSessionCsrfToken,
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

    const isNativeFormSubmission = request.headers
      .get("content-type")
      ?.startsWith("application/x-www-form-urlencoded");
    const form = isNativeFormSubmission ? await request.formData() : null;
    const formCsrfToken = form?.get("csrfToken");
    const csrfValid = isNativeFormSubmission
      ? hasValidSessionCsrfToken(
          typeof formCsrfToken === "string" && formCsrfToken
            ? formCsrfToken
            : readSessionCsrfToken(request.headers),
          request.headers,
          session.sessionId,
          environment.CSRF_HMAC_KEY,
        )
      : hasValidSessionCsrfRequest(
          request.headers,
          session.sessionId,
          environment.CSRF_HMAC_KEY,
        );
    if (
      !isTrustedMutationRequest(request, runtimeEnvironment.APP_ORIGIN) ||
      !csrfValid
    ) {
      return requestNotAllowed();
    }

    const input: unknown = isNativeFormSubmission
      ? {
          employeeNumber: form?.get("employeeNumber"),
          passcode: form?.get("passcode"),
        }
      : await request.json();
    const result = await completeTemporaryPasscodeChange(
      input,
      session.account.authUserId,
      client,
      {
        employeeLookupHmacKey: environment.EMPLOYEE_LOOKUP_PEPPER,
        store: createTemporaryPasscodeChangeStore(),
      },
    );
    if (result.status === "invalid_input")
      return isNativeFormSubmission
        ? accountRedirect(runtimeEnvironment.APP_ORIGIN, "passcode")
        : invalidInput();
    if (result.status !== "completed")
      return isNativeFormSubmission
        ? accountRedirect(runtimeEnvironment.APP_ORIGIN, "unavailable")
        : unavailable();

    const response = NextResponse.json(
      { data: { status: "passcode_changed" } },
      { headers: NO_STORE_HEADERS },
    );
    response.cookies.delete(CSRF_TOKEN_COOKIE);
    response.cookies.delete(CSRF_DIGEST_COOKIE);
    response.cookies.delete("go-auth-device");
    return isNativeFormSubmission
      ? completedRedirect(runtimeEnvironment.APP_ORIGIN, response)
      : response;
  } catch {
    return unavailable();
  }
}

function completedRedirect(applicationOrigin: string, response: NextResponse) {
  const redirect = NextResponse.redirect(new URL("/login", applicationOrigin), {
    status: 303,
  });
  for (const cookie of response.cookies.getAll()) {
    redirect.cookies.set(cookie);
  }
  return redirect;
}

function accountRedirect(applicationOrigin: string, error: string) {
  return NextResponse.redirect(
    new URL(`/account?error=${encodeURIComponent(error)}`, applicationOrigin),
    { status: 303 },
  );
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
