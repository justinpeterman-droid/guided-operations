import { randomUUID } from "node:crypto";

import { getAuthServerEnvironment } from "@/lib/env/auth-server";
import { getIncidentServerEnvironment } from "@/lib/env/incident-server";
import { getRuntimeEnvironment } from "@/lib/env/runtime";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { authorizeCurrentSession } from "@/server/auth/current-session";
import { restoreReportRevisionForCurrentSession } from "@/server/incidents/restore-report-revision";
import { validateReportRestoreRequest } from "@/server/incidents/restore-report-revision-endpoint";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const headers = { "Cache-Control": "private, no-store" };

export async function POST(
  request: Request,
  context: { params: Promise<{ reportId: string }> },
): Promise<Response> {
  const requestId = randomUUID();
  try {
    const [{ reportId }, auth, incident, runtimeEnvironment, client] =
      await Promise.all([
        context.params,
        getAuthServerEnvironment(),
        getIncidentServerEnvironment(),
        getRuntimeEnvironment(),
        createSupabaseServerClient(),
      ]);
    const session = await authorizeCurrentSession(client);
    if (!session.allowed)
      return error(401, "authentication_required", requestId);
    const validation = await validateReportRestoreRequest(
      request,
      runtimeEnvironment.APP_ORIGIN,
      session.sessionId,
      auth.CSRF_HMAC_KEY,
    );
    if (!validation.ok)
      return error(validation.status, validation.code, requestId);
    const result = await restoreReportRevisionForCurrentSession(
      {
        reportId,
        baseRevisionNumber: validation.baseRevisionNumber,
        restoreRevisionNumber: validation.restoreRevisionNumber,
        reason: validation.reason,
        idempotencyKey: validation.idempotencyKey,
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
