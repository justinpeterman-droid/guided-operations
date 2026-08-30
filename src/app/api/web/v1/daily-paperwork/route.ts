import { randomUUID } from "node:crypto";

import { getAuthServerEnvironment } from "@/lib/env/auth-server";
import { getIncidentServerEnvironment } from "@/lib/env/incident-server";
import { getRuntimeEnvironment } from "@/lib/env/runtime";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { authorizeCurrentSession } from "@/server/auth/current-session";
import { getDailyPaperworkForCurrentSession } from "@/server/paperwork/get-daily-paperwork";
import { validateDailyPaperworkSaveRequest } from "@/server/paperwork/save-daily-paperwork-endpoint";
import { saveDailyPaperworkForCurrentSession } from "@/server/paperwork/save-daily-paperwork";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const responseHeaders = { "Cache-Control": "private, no-store" };

export async function GET(request: Request): Promise<Response> {
  const requestId = randomUUID();
  try {
    const url = new URL(request.url);
    const client = await createSupabaseServerClient();
    const result = await getDailyPaperworkForCurrentSession(
      {
        kind: url.searchParams.get("kind"),
        workDate: url.searchParams.get("work_date"),
        shiftCode: url.searchParams.get("shift_code"),
      },
      client,
    );
    if (result.kind === "found")
      return Response.json(
        {
          data: result.paperwork,
          meta: { request_id: requestId, api_version: "web-v1" },
        },
        { status: 200, headers: responseHeaders },
      );
    return error(
      result.kind === "denied"
        ? 401
        : result.kind === "not_found"
          ? 400
          : result.kind === "not_configured"
            ? 404
            : 503,
      result.kind === "denied"
        ? "authentication_required"
        : result.kind === "not_found"
          ? "invalid_request"
          : result.kind === "not_configured"
            ? "form_not_configured"
            : "service_unavailable",
      requestId,
    );
  } catch {
    return error(503, "service_unavailable", requestId);
  }
}

export async function POST(request: Request): Promise<Response> {
  const requestId = randomUUID();
  try {
    const [auth, incident, runtime, client] = await Promise.all([
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

    const validated = await validateDailyPaperworkSaveRequest(
      request,
      runtime.APP_ORIGIN,
      session.sessionId,
      auth.CSRF_HMAC_KEY,
    );
    if (!validated.ok)
      return error(validated.status, validated.code, requestId);

    const result = await saveDailyPaperworkForCurrentSession(
      {
        kind: validated.kind,
        workDate: validated.workDate,
        shiftCode: validated.shiftCode,
        baseRevisionNumber: validated.baseRevisionNumber,
        payload: validated.payload,
        reason: validated.reason,
        idempotencyKey: validated.idempotencyKey,
      },
      client,
      incident.INCIDENT_IDEMPOTENCY_HMAC_KEY,
    );
    if (result.kind === "saved")
      return Response.json(
        {
          data: {
            recordId: result.recordId,
            revisionNumber: result.revisionNumber,
          },
          meta: { request_id: requestId, api_version: "web-v1" },
        },
        { status: 201, headers: responseHeaders },
      );

    return error(
      result.kind === "denied"
        ? 403
        : result.kind === "readonly"
          ? 423
          : result.kind === "conflict"
            ? 409
            : 503,
      result.kind === "denied"
        ? "request_not_allowed"
        : result.kind === "readonly"
          ? "form_read_only"
          : result.kind === "conflict"
            ? "revision_conflict"
            : "service_unavailable",
      requestId,
    );
  } catch {
    return error(503, "service_unavailable", requestId);
  }
}

function error(status: number, code: string, requestId: string): Response {
  return Response.json(
    {
      error: { code, message: "Request could not be completed." },
      meta: { request_id: requestId, api_version: "web-v1" },
    },
    { status, headers: responseHeaders },
  );
}
