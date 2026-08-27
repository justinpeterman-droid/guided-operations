import { z } from "zod";

import { getAuthServerEnvironment } from "@/lib/env/auth-server";
import { getRuntimeEnvironment } from "@/lib/env/runtime";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createAdminActionAuthorization } from "@/server/auth/authorize-admin-action";
import { authorizeCurrentSession } from "@/server/auth/current-session";
import { createAdminStepUpStore } from "@/server/auth/private-admin-step-up-store";
import { isTrustedMutationRequest } from "@/server/security/request-origin";
import { hasValidSessionCsrfRequest } from "@/server/security/session-csrf";
import {
  LEGAL_HOLD_SCOPE_TYPES,
  placeLegalHold,
} from "@/server/retention/legal-hold";
import { createLegalHoldStore } from "@/server/retention/private-legal-hold-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const headers = { "Cache-Control": "private, no-store" };
const inputSchema = z
  .object({
    requestId: z.string().uuid(),
    token: z.string().min(32).max(256),
    scopeType: z.enum(LEGAL_HOLD_SCOPE_TYPES),
    scopeId: z.string().uuid(),
    authorityReference: z.string().min(3).max(160),
  })
  .strict();

/** Places one target-validated hold after a same-session one-time approval. */
export async function POST(request: Request): Promise<Response> {
  try {
    const [environment, runtimeEnvironment, client] = await Promise.all([
      getAuthServerEnvironment(),
      getRuntimeEnvironment(),
      createSupabaseServerClient(),
    ]);
    const session = await authorizeCurrentSession(client, {
      requiredRole: "administrator",
    });
    if (!session.allowed) return denied();
    if (
      !isTrustedMutationRequest(request, runtimeEnvironment.APP_ORIGIN) ||
      !hasValidSessionCsrfRequest(
        request.headers,
        session.sessionId,
        environment.CSRF_HMAC_KEY,
      )
    )
      return forbidden();

    const parsed = inputSchema.safeParse(await request.json());
    if (!parsed.success) return invalid();
    const result = await placeLegalHold(
      {
        scopeType: parsed.data.scopeType,
        scopeId: parsed.data.scopeId,
        authorityReference: parsed.data.authorityReference,
      },
      {
        authorization: createAdminActionAuthorization(
          "retention.place_legal_hold",
          { requestId: parsed.data.requestId, token: parsed.data.token },
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
        store: createLegalHoldStore(),
      },
    );
    if (result.status === "placed")
      return Response.json(
        { data: { status: "placed", holdId: result.holdId } },
        { headers },
      );
    if (result.status === "invalid_input") return invalid();
    return result.status === "denied" ? denied() : unavailable();
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
  return Response.json({ error: "invalid_hold" }, { status: 400, headers });
}
function unavailable() {
  return Response.json(
    { error: "service_unavailable" },
    { status: 503, headers },
  );
}
