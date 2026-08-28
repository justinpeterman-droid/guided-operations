import { getAuthServerEnvironment } from "@/lib/env/auth-server";
import { getRuntimeEnvironment } from "@/lib/env/runtime";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { authorizeCurrentSession } from "@/server/auth/current-session";
import { createAdminStepUpStore } from "@/server/auth/private-admin-step-up-store";
import { requestAdminStepUp } from "@/server/auth/request-admin-step-up";
import { createSupabaseAdministratorPasscodeVerifier } from "@/server/auth/supabase-auth-adapters";
import { createAdminStepUpObserver } from "@/server/observability/admin-step-up-observer";
import { isTrustedMutationRequest } from "@/server/security/request-origin";
import { hasValidSessionCsrfRequest } from "@/server/security/session-csrf";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const NO_STORE_HEADERS = { "Cache-Control": "private, no-store" };

/**
 * Issues one short-lived, single-use proof after an administrator confirms
 * their own passcode. The proof is valid only for creating one account.
 */
export async function POST(request: Request): Promise<Response> {
  const observe = createAdminStepUpObserver();
  let appEnvironment: "development" | "preview" | "production" | "test" =
    "test";
  try {
    const [environment, runtimeEnvironment, client] = await Promise.all([
      getAuthServerEnvironment(),
      getRuntimeEnvironment(),
      createSupabaseServerClient(),
    ]);
    appEnvironment = runtimeEnvironment.APP_ENV;
    const currentSession = await authorizeCurrentSession(client, {
      requiredRole: "administrator",
    });
    if (!currentSession.allowed)
      return observe(
        authenticationRequired(),
        "authentication_required",
        appEnvironment,
      );
    if (
      !isTrustedMutationRequest(request, runtimeEnvironment.APP_ORIGIN) ||
      !hasValidSessionCsrfRequest(
        request.headers,
        currentSession.sessionId,
        environment.CSRF_HMAC_KEY,
      )
    ) {
      return observe(
        requestNotAllowed(),
        "request_not_allowed",
        appEnvironment,
      );
    }

    const session = await requestAdminStepUp(
      client,
      "account.create",
      await request.json(),
      {
        verifier: createSupabaseAdministratorPasscodeVerifier(),
        store: createAdminStepUpStore(),
        hmacKey: environment.CSRF_HMAC_KEY,
      },
    );

    if (session.status === "invalid_input")
      return observe(invalidInput(), "validation_rejected", appEnvironment);
    if (session.status === "denied")
      return observe(
        authenticationRequired(),
        "authentication_required",
        appEnvironment,
      );
    if (session.status !== "issued")
      return observe(unavailable(), "service_unavailable", appEnvironment);
    return observe(
      Response.json(
        { data: { requestId: session.requestId, token: session.token } },
        { headers: NO_STORE_HEADERS },
      ),
      "issued",
      appEnvironment,
    );
  } catch {
    return observe(unavailable(), "service_unavailable", appEnvironment);
  }
}

function authenticationRequired(): Response {
  return Response.json(
    { error: "authentication_required" },
    { status: 401, headers: NO_STORE_HEADERS },
  );
}

function requestNotAllowed(): Response {
  return Response.json(
    { error: "request_not_allowed" },
    { status: 403, headers: NO_STORE_HEADERS },
  );
}

function invalidInput(): Response {
  return Response.json(
    { error: "invalid_passcode" },
    { status: 400, headers: NO_STORE_HEADERS },
  );
}

function unavailable(): Response {
  return Response.json(
    { error: "service_unavailable" },
    { status: 503, headers: NO_STORE_HEADERS },
  );
}
