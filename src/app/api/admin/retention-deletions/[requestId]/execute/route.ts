import { z } from "zod";

import { getAuthServerEnvironment } from "@/lib/env/auth-server";
import { getRuntimeEnvironment } from "@/lib/env/runtime";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createAdminActionAuthorization } from "@/server/auth/authorize-admin-action";
import { authorizeCurrentSession } from "@/server/auth/current-session";
import { createAdminStepUpStore } from "@/server/auth/private-admin-step-up-store";
import { isTrustedMutationRequest } from "@/server/security/request-origin";
import { hasValidSessionCsrfRequest } from "@/server/security/session-csrf";
import { createRetentionDeletionStore } from "@/server/retention/private-retention-deletion-store";
import { executeRetentionDeletion } from "@/server/retention/retention-deletion";
import { createSupabaseRetentionArtifactCleanup } from "@/server/retention/supabase-retention-artifact-cleanup";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const headers = { "Cache-Control": "private, no-store" };
const inputSchema = z
  .object({
    requestId: z.string().uuid(),
    token: z.string().min(32).max(256),
    confirmRecordId: z.string().uuid(),
  })
  .strict();

/** Permanently deletes one approved target after a separate one-time proof. */
export async function POST(
  request: Request,
  context: Readonly<{ params: Promise<Readonly<{ requestId: string }>> }>,
): Promise<Response> {
  try {
    const [{ requestId }, environment, runtimeEnvironment, client] =
      await Promise.all([
        context.params,
        getAuthServerEnvironment(),
        getRuntimeEnvironment(),
        createSupabaseServerClient(),
      ]);
    if (!z.string().uuid().safeParse(requestId).success) return invalid();
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
    const result = await executeRetentionDeletion(
      { requestId, confirmRecordId: parsed.data.confirmRecordId },
      {
        authorization: createAdminActionAuthorization(
          "retention.execute_deletion",
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
        store: createRetentionDeletionStore(),
        cleanup: createSupabaseRetentionArtifactCleanup(),
      },
    );
    if (result.status === "completed")
      return Response.json(
        {
          data: {
            status: "completed",
            databaseRowsDeleted: result.databaseRowsDeleted,
            artifactsDeleted: result.artifactsDeleted,
          },
        },
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
  return Response.json(
    { error: "invalid_deletion_execution" },
    { status: 400, headers },
  );
}
function unavailable() {
  return Response.json(
    { error: "service_unavailable" },
    { status: 503, headers },
  );
}
