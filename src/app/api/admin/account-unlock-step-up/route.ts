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
const headers = { "Cache-Control": "private, no-store" };

/** Issues a proof valid only for one administrator account-unlock action. */
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
    const current = await authorizeCurrentSession(client, {
      requiredRole: "administrator",
    });
    if (!current.allowed)
      return observe(denied(), "authentication_required", appEnvironment);
    if (
      !isTrustedMutationRequest(request, runtimeEnvironment.APP_ORIGIN) ||
      !hasValidSessionCsrfRequest(
        request.headers,
        current.sessionId,
        environment.CSRF_HMAC_KEY,
      )
    )
      return observe(forbidden(), "request_not_allowed", appEnvironment);
    const result = await requestAdminStepUp(
      client,
      "account.unlock",
      await request.json(),
      {
        verifier: createSupabaseAdministratorPasscodeVerifier(),
        store: createAdminStepUpStore(),
        hmacKey: environment.CSRF_HMAC_KEY,
      },
    );
    if (result.status === "issued")
      return observe(
        Response.json(
          { data: { requestId: result.requestId, token: result.token } },
          { headers },
        ),
        "issued",
        appEnvironment,
      );
    const response = Response.json(
      {
        error:
          result.status === "invalid_input"
            ? "invalid_passcode"
            : "authentication_required",
      },
      {
        status:
          result.status === "unavailable"
            ? 503
            : result.status === "invalid_input"
              ? 400
              : 401,
        headers,
      },
    );
    return observe(
      response,
      result.status === "unavailable"
        ? "service_unavailable"
        : result.status === "invalid_input"
          ? "validation_rejected"
          : "authentication_required",
      appEnvironment,
    );
  } catch {
    return observe(
      Response.json({ error: "service_unavailable" }, { status: 503, headers }),
      "service_unavailable",
      appEnvironment,
    );
  }
}
function denied() {
  return Response.json(
    { error: "authentication_required" },
    { status: 401, headers },
  );
}
function forbidden() {
  return Response.json(
    { error: "request_not_allowed" },
    { status: 403, headers },
  );
}
