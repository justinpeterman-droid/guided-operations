import { z } from "zod";

import { getAuthServerEnvironment } from "@/lib/env/auth-server";
import { getRuntimeEnvironment } from "@/lib/env/runtime";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { authorizeCurrentSession } from "@/server/auth/current-session";
import { createAdminStepUpStore } from "@/server/auth/private-admin-step-up-store";
import { requestAdminStepUp } from "@/server/auth/request-admin-step-up";
import { createSupabaseAdministratorPasscodeVerifier } from "@/server/auth/supabase-auth-adapters";
import { createDailyPaperworkTemplateStepUpTargetStore } from "@/server/paperwork/private-daily-paperwork-template-step-up-target-store";
import { isTrustedMutationRequest } from "@/server/security/request-origin";
import { hasValidSessionCsrfRequest } from "@/server/security/session-csrf";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const NO_STORE_HEADERS = { "Cache-Control": "private, no-store" };
const requestSchema = z
  .object({
    action: z.enum(["import", "rollback"]),
    passcode: z.string().min(1).max(128),
    packageDigest: z.string().regex(/^[a-f0-9]{64}$/u),
  })
  .strict();

/** Issues one Production-only proof for one exact package import or rollback. */
export async function POST(request: Request): Promise<Response> {
  try {
    const [environment, runtimeEnvironment, client] = await Promise.all([
      getAuthServerEnvironment(),
      getRuntimeEnvironment(),
      createSupabaseServerClient(),
    ]);
    if (runtimeEnvironment.APP_ENV !== "production") return notFound();

    const currentSession = await authorizeCurrentSession(client, {
      requiredRole: "administrator",
    });
    if (!currentSession.allowed) return authenticationRequired();
    if (
      !isTrustedMutationRequest(request, runtimeEnvironment.APP_ORIGIN) ||
      !hasValidSessionCsrfRequest(
        request.headers,
        currentSession.sessionId,
        environment.CSRF_HMAC_KEY,
      )
    )
      return requestNotAllowed();

    const parsed = requestSchema.safeParse(await request.json());
    if (!parsed.success) return invalidInput();
    const purpose =
      parsed.data.action === "rollback"
        ? "paperwork.template_rollback"
        : "paperwork.template_import";
    const result = await requestAdminStepUp(
      client,
      purpose,
      { passcode: parsed.data.passcode },
      {
        verifier: createSupabaseAdministratorPasscodeVerifier(),
        store: createAdminStepUpStore(),
        hmacKey: environment.CSRF_HMAC_KEY,
      },
    );
    if (result.status === "invalid_input") return invalidInput();
    if (result.status === "denied") return authenticationRequired();
    if (result.status !== "issued") return unavailable();
    const bound = await createDailyPaperworkTemplateStepUpTargetStore().bind({
      authUserId: currentSession.account.authUserId,
      sessionId: currentSession.sessionId,
      authVersion: currentSession.account.authVersion,
      purpose,
      requestId: result.requestId,
      packageDigest: parsed.data.packageDigest,
    });
    if (!bound) return unavailable();
    return Response.json(
      { data: { requestId: result.requestId, token: result.token } },
      { headers: NO_STORE_HEADERS },
    );
  } catch {
    return unavailable();
  }
}

function notFound(): Response {
  return Response.json(
    { error: "not_found" },
    { status: 404, headers: NO_STORE_HEADERS },
  );
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
