import { randomUUID } from "node:crypto";

import { z } from "zod";

import { getAuthServerEnvironment } from "@/lib/env/auth-server";
import { getRuntimeEnvironment } from "@/lib/env/runtime";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createAdminActionAuthorization } from "@/server/auth/authorize-admin-action";
import { authorizeCurrentSession } from "@/server/auth/current-session";
import { createAdminStepUpStore } from "@/server/auth/private-admin-step-up-store";
import { createAccountPasscodeResetStore } from "@/server/auth/private-invited-account-store";
import { resetAccountPasscode } from "@/server/auth/reset-account-passcode";
import { createSupabaseAuthPasswordResetter } from "@/server/auth/supabase-auth-adapters";
import {
  boundedOperationalDuration,
  observedResponse,
} from "@/server/observability/observed-response";
import type { SafeOperationalEventInput } from "@/server/observability/safe-operational-event";
import { isTrustedMutationRequest } from "@/server/security/request-origin";
import { hasValidSessionCsrfRequest } from "@/server/security/session-csrf";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const headers = { "Cache-Control": "private, no-store" };
const proofSchema = z
  .object({ requestId: z.string().uuid(), token: z.string().min(32).max(256) })
  .strict();

/** Resets one account passcode after a same-session, one-time admin proof. */
export async function POST(
  request: Request,
  context: Readonly<{ params: Promise<Readonly<{ accountId: string }>> }>,
): Promise<Response> {
  const correlationId = randomUUID();
  const startedAt = Date.now();
  let appEnvironment: SafeOperationalEventInput["environment"] = "test";
  const observe = (
    response: Response,
    outcome: SafeOperationalEventInput["outcome"],
  ) =>
    observedResponse(response, {
      event_name: "admin.account_reset_passcode",
      outcome,
      request_id: correlationId,
      status_code: response.status,
      duration_ms: boundedOperationalDuration(startedAt),
      environment: appEnvironment,
    });

  try {
    const [{ accountId }, environment, runtimeEnvironment, client] =
      await Promise.all([
        context.params,
        getAuthServerEnvironment(),
        getRuntimeEnvironment(),
        createSupabaseServerClient(),
      ]);
    appEnvironment = runtimeEnvironment.APP_ENV;
    if (!z.string().uuid().safeParse(accountId).success)
      return observe(invalid(), "validation_rejected");
    const session = await authorizeCurrentSession(client, {
      requiredRole: "administrator",
    });
    if (!session.allowed) return observe(denied(), "authentication_required");
    if (
      !isTrustedMutationRequest(request, runtimeEnvironment.APP_ORIGIN) ||
      !hasValidSessionCsrfRequest(
        request.headers,
        session.sessionId,
        environment.CSRF_HMAC_KEY,
      )
    )
      return observe(forbidden(), "request_not_allowed");
    const proof = proofSchema.safeParse(await request.json());
    if (!proof.success) return observe(invalid(), "validation_rejected");
    const result = await resetAccountPasscode(
      { targetAuthUserId: accountId },
      {
        authorization: createAdminActionAuthorization(
          "account.reset_passcode",
          proof.data,
          {
            authUserId: session.account.authUserId,
            sessionId: session.sessionId,
            authVersion: session.account.authVersion,
          },
          {
            store: createAdminStepUpStore(),
            hmacKey: environment.CSRF_HMAC_KEY,
          },
        ),
        store: createAccountPasscodeResetStore(),
        passwordResetter: createSupabaseAuthPasswordResetter(),
      },
    );
    if (result.status === "reset")
      return observe(
        Response.json(
          {
            data: {
              temporaryPasscode: result.temporaryPasscode,
              temporaryPasscodeExpiresAt: result.expiresAt.toISOString(),
            },
          },
          { headers },
        ),
        "reset",
      );
    return result.status === "denied"
      ? observe(denied(), "authentication_required")
      : observe(unavailable(), "service_unavailable");
  } catch {
    return observe(unavailable(), "service_unavailable");
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
  return Response.json({ error: "invalid_account" }, { status: 400, headers });
}
function unavailable() {
  return Response.json(
    { error: "service_unavailable" },
    { status: 503, headers },
  );
}
