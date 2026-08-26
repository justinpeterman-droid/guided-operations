import { randomUUID } from "node:crypto";

import { getAuthServerEnvironment } from "@/lib/env/auth-server";
import { getIncidentServerEnvironment } from "@/lib/env/incident-server";
import { getRuntimeEnvironment } from "@/lib/env/runtime";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { authorizeCurrentSession } from "@/server/auth/current-session";
import { validateCountSheetSaveRequest } from "@/server/paperwork/save-count-sheet-endpoint";
import { saveCountSheetForCurrentSession } from "@/server/paperwork/save-count-sheet";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const headers = { "Cache-Control": "private, no-store" };

export async function POST(request: Request): Promise<Response> {
  const requestId = randomUUID();
  try {
    const [auth, incident, runtime, client] = await Promise.all([
      getAuthServerEnvironment(),
      getIncidentServerEnvironment(),
      getRuntimeEnvironment(),
      createSupabaseServerClient(),
    ]);
    const session = await authorizeCurrentSession(client);
    if (!session.allowed)
      return error(401, "authentication_required", requestId);

    const validated = await validateCountSheetSaveRequest(
      request,
      runtime.APP_ORIGIN,
      session.sessionId,
      auth.CSRF_HMAC_KEY,
    );
    if (!validated.ok)
      return error(validated.status, validated.code, requestId);

    const saved = await saveCountSheetForCurrentSession(
      validated,
      client,
      incident.INCIDENT_IDEMPOTENCY_HMAC_KEY,
    );
    if (saved.kind === "saved") {
      return Response.json(
        {
          data: {
            recordId: saved.recordId,
            revisionNumber: saved.revisionNumber,
          },
          meta: { request_id: requestId, api_version: "web-v1" },
        },
        { status: 201, headers },
      );
    }

    return error(
      saved.kind === "denied" ? 403 : saved.kind === "conflict" ? 409 : 503,
      saved.kind === "denied"
        ? "request_not_allowed"
        : saved.kind === "conflict"
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
    { status, headers },
  );
}
