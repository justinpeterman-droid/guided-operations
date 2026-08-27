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
import { approveRetentionDeletion } from "@/server/retention/retention-deletion";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const headers = { "Cache-Control": "private, no-store" };
const inputSchema = z
  .object({
    requestId: z.string().uuid(),
    token: z.string().min(32).max(256),
    recordType: z.enum(["incident", "paperwork_record"]),
    recordId: z.string().uuid(),
    authorityReference: z.string().min(3).max(160),
    databaseBackupReference: z.string().min(3).max(160),
    storageBackupReference: z.string().min(3).max(160),
    backupManifestSha256: z.string().regex(/^[a-f0-9]{64}$/),
    backupVerifiedAt: z.iso.datetime({ offset: true }),
    backupExpiresAt: z.iso.datetime({ offset: true }),
  })
  .strict();

/** Records one backup-aware approval; it never deletes records or objects. */
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
    const result = await approveRetentionDeletion(
      {
        recordType: parsed.data.recordType,
        recordId: parsed.data.recordId,
        authorityReference: parsed.data.authorityReference,
        databaseBackupReference: parsed.data.databaseBackupReference,
        storageBackupReference: parsed.data.storageBackupReference,
        backupManifestSha256: parsed.data.backupManifestSha256,
        backupVerifiedAt: parsed.data.backupVerifiedAt,
        backupExpiresAt: parsed.data.backupExpiresAt,
      },
      {
        authorization: createAdminActionAuthorization(
          "retention.approve_deletion",
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
      },
    );
    if (result.status === "approved")
      return Response.json(
        { data: { status: "approved", requestId: result.requestId } },
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
    { error: "invalid_deletion_approval" },
    { status: 400, headers },
  );
}
function unavailable() {
  return Response.json(
    { error: "service_unavailable" },
    { status: 503, headers },
  );
}
