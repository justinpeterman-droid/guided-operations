import { randomUUID } from "node:crypto";

import { getAuthServerEnvironment } from "@/lib/env/auth-server";
import { getIncidentServerEnvironment } from "@/lib/env/incident-server";
import { getRuntimeEnvironment } from "@/lib/env/runtime";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { authorizeCurrentSession } from "@/server/auth/current-session";
import { restoreDailyPaperworkRevisionForCurrentSession } from "@/server/paperwork/restore-daily-paperwork-revision";
import { validateDailyPaperworkRestoreRequest } from "@/server/paperwork/restore-daily-paperwork-revision-endpoint";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const headers = { "Cache-Control": "private, no-store" };

export async function POST(
  request: Request,
  context: { params: Promise<{ recordId: string }> },
): Promise<Response> {
  const requestId = randomUUID();
  try {
    const [{ recordId }, auth, incident, runtimeEnvironment, client] =
      await Promise.all([
        context.params,
        getAuthServerEnvironment(),
        getIncidentServerEnvironment(),
        getRuntimeEnvironment(),
        createSupabaseServerClient(),
      ]);
    const session = await authorizeCurrentSession(client, {
      requiredRole: "administrator",
    });
    if (!session.allowed)
      return error(401, "authentication_required", requestId);
    const validated = await validateDailyPaperworkRestoreRequest(
      request,
      runtimeEnvironment.APP_ORIGIN,
      session.sessionId,
      auth.CSRF_HMAC_KEY,
    );
    if (!validated.ok)
      return error(validated.status, validated.code, requestId);
    const result = await restoreDailyPaperworkRevisionForCurrentSession(
      {
        recordId,
        baseRevisionNumber: validated.baseRevisionNumber,
        restoreRevisionNumber: validated.restoreRevisionNumber,
        reason: validated.reason,
        idempotencyKey: validated.idempotencyKey,
      },
      client,
      incident.INCIDENT_IDEMPOTENCY_HMAC_KEY,
    );
    if (result.kind === "restored")
      return Response.json(
        {
          data: { revisionNumber: result.revisionNumber },
          meta: { request_id: requestId, api_version: "web-v1" },
        },
        { status: 201, headers },
      );
    return error(
      result.kind === "denied" ? 403 : result.kind === "conflict" ? 409 : 503,
      result.kind === "denied"
        ? "request_not_allowed"
        : result.kind === "conflict"
          ? "revision_conflict"
          : "service_unavailable",
      requestId,
    );
  } catch {
    return error(503, "service_unavailable", requestId);
  }
}

function error(status: number, code: string, requestId: string) {
  return Response.json(
    {
      error: { code, message: "Request could not be completed." },
      meta: { request_id: requestId, api_version: "web-v1" },
    },
    { status, headers },
  );
}
