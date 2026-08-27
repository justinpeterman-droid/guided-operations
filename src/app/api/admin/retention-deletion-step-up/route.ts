import { z } from "zod";

import { getAuthServerEnvironment } from "@/lib/env/auth-server";
import { getRuntimeEnvironment } from "@/lib/env/runtime";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AdminStepUpPurpose } from "@/server/auth/admin-step-up";
import { authorizeCurrentSession } from "@/server/auth/current-session";
import { createAdminStepUpStore } from "@/server/auth/private-admin-step-up-store";
import { requestAdminStepUp } from "@/server/auth/request-admin-step-up";
import { createSupabaseAdministratorPasscodeVerifier } from "@/server/auth/supabase-auth-adapters";
import { isTrustedMutationRequest } from "@/server/security/request-origin";
import { hasValidSessionCsrfRequest } from "@/server/security/session-csrf";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const headers = { "Cache-Control": "private, no-store" };
const inputSchema = z
  .object({
    action: z.enum(["approve", "execute"]),
    passcode: z.string().min(8).max(256),
  })
  .strict();

/** Issues a one-time proof for approval or execution, never both. */
export async function POST(request: Request): Promise<Response> {
  try {
    const [environment, runtimeEnvironment, client] = await Promise.all([
      getAuthServerEnvironment(),
      getRuntimeEnvironment(),
      createSupabaseServerClient(),
    ]);
    const current = await authorizeCurrentSession(client, {
      requiredRole: "administrator",
    });
    if (!current.allowed) return denied();
    if (
      !isTrustedMutationRequest(request, runtimeEnvironment.APP_ORIGIN) ||
      !hasValidSessionCsrfRequest(
        request.headers,
        current.sessionId,
        environment.CSRF_HMAC_KEY,
      )
    )
      return forbidden();

    const parsed = inputSchema.safeParse(await request.json());
    if (!parsed.success) return invalid();
    const purpose: AdminStepUpPurpose =
      parsed.data.action === "approve"
        ? "retention.approve_deletion"
        : "retention.execute_deletion";
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
    if (result.status === "issued")
      return Response.json(
        { data: { requestId: result.requestId, token: result.token } },
        { headers },
      );
    if (result.status === "invalid_input") return invalid();
    return result.status === "unavailable" ? unavailable() : denied();
  } catch {
    return unavailable();
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
function invalid() {
  return Response.json({ error: "invalid_request" }, { status: 400, headers });
}
function unavailable() {
  return Response.json(
    { error: "service_unavailable" },
    { status: 503, headers },
  );
}
