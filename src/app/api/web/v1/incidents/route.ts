import { randomUUID } from "node:crypto";

import { getAuthServerEnvironment } from "@/lib/env/auth-server";
import { getIncidentServerEnvironment } from "@/lib/env/incident-server";
import { getRuntimeEnvironment } from "@/lib/env/runtime";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { authorizeCurrentSession } from "@/server/auth/current-session";
import { validateCreateIncidentEndpointRequest } from "@/server/incidents/create-incident-endpoint";
import { createIncidentForAuthorizedSession } from "@/server/incidents/create-incident";
import { listIncidentsForCurrentSession } from "@/server/incidents/list-incidents";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const API_VERSION = "web-v1";
const NO_STORE_HEADERS = { "Cache-Control": "private, no-store" };

/** Returns summary-only incidents authorized for the current account. */
export async function GET(request: Request): Promise<Response> {
  const requestId = randomUUID();
  const limit = parseListLimit(request.url);
  if (!limit) return errorResponse(400, "invalid_request", requestId);

  try {
    const client = await createSupabaseServerClient();
    const result = await listIncidentsForCurrentSession(client, limit);
    if (result.kind === "listed") {
      return Response.json(
        {
          data: { incidents: result.incidents },
          meta: { request_id: requestId, api_version: API_VERSION },
        },
        { headers: NO_STORE_HEADERS },
      );
    }

    return errorResponse(
      result.kind === "denied" ? 401 : 503,
      result.kind === "denied"
        ? "authentication_required"
        : "service_unavailable",
      requestId,
    );
  } catch {
    return errorResponse(503, "service_unavailable", requestId);
  }
}

/** Creates the first immutable fictional incident revision for the current user. */
export async function POST(request: Request): Promise<Response> {
  const requestId = randomUUID();

  try {
    const [authEnvironment, incidentEnvironment, runtimeEnvironment, client] =
      await Promise.all([
        getAuthServerEnvironment(),
        getIncidentServerEnvironment(),
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
      incidentEnvironment.INCIDENT_IDEMPOTENCY_HMAC_KEY,
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

function parseListLimit(url: string): number | null {
  const rawLimit = new URL(url).searchParams.get("limit");
  if (rawLimit === null) return 50;
  if (!/^[1-9][0-9]{0,2}$/.test(rawLimit)) return null;

  const limit = Number(rawLimit);
  return limit <= 100 ? limit : null;
}
