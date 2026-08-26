import { randomUUID } from "node:crypto";

import { getAuthServerEnvironment } from "@/lib/env/auth-server";
import { getRuntimeEnvironment } from "@/lib/env/runtime";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { authorizeCurrentSession } from "@/server/auth/current-session";
import { validateCreateIncidentEndpointRequest } from "@/server/incidents/create-incident-endpoint";
import { createIncidentForAuthorizedSession } from "@/server/incidents/create-incident";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const API_VERSION = "web-v1";
const NO_STORE_HEADERS = { "Cache-Control": "private, no-store" };

/** Creates the first immutable fictional incident revision for the current user. */
export async function POST(request: Request): Promise<Response> {
  const requestId = randomUUID();

  try {
    const [authEnvironment, runtimeEnvironment, client] = await Promise.all([
      getAuthServerEnvironment(),
      getRuntimeEnvironment(),
      createSupabaseServerClient(),
    ]);
    const session = await authorizeCurrentSession(client);
    if (!session.allowed) {
      return errorResponse(401, "authentication_required", requestId);
    }

    const validation = await validateCreateIncidentEndpointRequest(
      request,
      runtimeEnvironment.APP_ORIGIN,
      session.sessionId,
      authEnvironment.CSRF_HMAC_KEY,
    );
    if (!validation.ok) {
      return errorResponse(validation.status, validation.code, requestId);
    }

    const result = await createIncidentForAuthorizedSession(
      validation.command,
      session,
      client,
      authEnvironment.CSRF_HMAC_KEY,
    );
    if (result.kind === "created") {
      return Response.json(
        {
          data: { incidentId: result.incidentId },
          meta: { request_id: requestId, api_version: API_VERSION },
        },
        { status: 201, headers: NO_STORE_HEADERS },
      );
    }

    return errorResponse(
      result.kind === "denied" ? 403 : 503,
      result.kind === "denied" ? "request_not_allowed" : "service_unavailable",
      requestId,
    );
  } catch {
    return errorResponse(503, "service_unavailable", requestId);
  }
}

function errorResponse(
  status: number,
  code: string,
  requestId: string,
): Response {
  return Response.json(
    {
      error: { code, message: "Request could not be completed." },
      meta: { request_id: requestId, api_version: API_VERSION },
    },
    { status, headers: NO_STORE_HEADERS },
  );
}
