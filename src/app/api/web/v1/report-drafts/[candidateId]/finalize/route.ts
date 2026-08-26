import { randomUUID } from "node:crypto";

import { getAuthServerEnvironment } from "@/lib/env/auth-server";
import { getIncidentServerEnvironment } from "@/lib/env/incident-server";
import { getRuntimeEnvironment } from "@/lib/env/runtime";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { authorizeCurrentSession } from "@/server/auth/current-session";
import { finalizeReportDraftForCurrentSession } from "@/server/incidents/finalize-report-draft";
import { validateReportFinalizationEndpointRequest } from "@/server/incidents/report-finalization-endpoint";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const HEADERS = { "Cache-Control": "private, no-store" };

export async function POST(
  request: Request,
  context: { params: Promise<{ candidateId: string }> },
): Promise<Response> {
  const requestId = randomUUID();
  try {
    const [{ candidateId }, auth, incident, runtime, client] =
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
    const validation = await validateReportFinalizationEndpointRequest(
      request,
      runtime.APP_ORIGIN,
      session.sessionId,
      auth.CSRF_HMAC_KEY,
    );
    if (!validation.ok)
      return error(validation.status, validation.code, requestId);
    const result = await finalizeReportDraftForCurrentSession(
      {
        candidateId,
        narrative: validation.narrative,
        reviewedByOfficer: validation.reviewedByOfficer,
        idempotencyKey: validation.idempotencyKey,
      },
      client,
      incident.INCIDENT_IDEMPOTENCY_HMAC_KEY,
    );
    if (result.kind === "finalized")
      return Response.json(
        {
          data: { reportId: result.reportId },
          meta: { request_id: requestId, api_version: "web-v1" },
        },
        { status: 201, headers: HEADERS },
      );
    return error(
      result.kind === "denied" ? 403 : 503,
      result.kind === "denied" ? "request_not_allowed" : "service_unavailable",
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
    { status, headers: HEADERS },
  );
}
