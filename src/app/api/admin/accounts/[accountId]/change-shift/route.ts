import { z } from "zod";

import { getAuthServerEnvironment } from "@/lib/env/auth-server";
import { getRuntimeEnvironment } from "@/lib/env/runtime";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createAdminActionAuthorization } from "@/server/auth/authorize-admin-action";
import { changeAccountShift } from "@/server/auth/change-account-shift";
import { authorizeCurrentSession } from "@/server/auth/current-session";
import { createAdminStepUpStore } from "@/server/auth/private-admin-step-up-store";
import { createAccountShiftChangeStore } from "@/server/auth/private-invited-account-store";
import { isTrustedMutationRequest } from "@/server/security/request-origin";
import { hasValidSessionCsrfRequest } from "@/server/security/session-csrf";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const headers = { "Cache-Control": "private, no-store" };
const requestSchema = z
  .object({
    requestId: z.uuid(),
    token: z.string().min(32).max(256),
    newShiftCode: z.enum(["A", "B", "C", "D", "U", "F"]),
  })
  .strict();

/** Changes one active account shift after a same-session one-time proof. */
export async function POST(
  request: Request,
  context: Readonly<{ params: Promise<Readonly<{ accountId: string }>> }>,
): Promise<Response> {
  try {
    const [{ accountId }, environment, runtimeEnvironment, client] =
      await Promise.all([
        context.params,
        getAuthServerEnvironment(),
        getRuntimeEnvironment(),
        createSupabaseServerClient(),
      ]);
    if (!z.uuid().safeParse(accountId).success) return invalid();
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
    const parsed = requestSchema.safeParse(await request.json());
    if (!parsed.success) return invalid();
    const result = await changeAccountShift(
      { targetAuthUserId: accountId, newShiftCode: parsed.data.newShiftCode },
      {
        authorization: createAdminActionAuthorization(
          "account.change_shift",
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
        store: createAccountShiftChangeStore(),
      },
    );
    if (result === "changed")
      return Response.json(
        { data: { status: "changed", shiftCode: parsed.data.newShiftCode } },
        { headers },
      );
    return result === "denied" ? denied() : unavailable();
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
  return Response.json({ error: "invalid_account" }, { status: 400, headers });
}
function unavailable() {
  return Response.json(
    { error: "service_unavailable" },
    { status: 503, headers },
  );
}
