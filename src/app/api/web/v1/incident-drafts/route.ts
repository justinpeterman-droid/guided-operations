import { readDraftJson } from "@/server/incidents/incident-draft-body";
import { randomUUID } from "node:crypto";

import { getAuthServerEnvironment } from "@/lib/env/auth-server";
import { getIncidentServerEnvironment } from "@/lib/env/incident-server";
import { getRuntimeEnvironment } from "@/lib/env/runtime";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { incidentDraftSaveRequestSchema } from "@/features/incidents/incident-draft";
import { authorizeCurrentSession } from "@/server/auth/current-session";
import {
  listIncidentDraftsForCurrentSession,
  saveIncidentDraftForAuthorizedSession,
} from "@/server/incidents/incident-drafts";
import { isTrustedMutationRequest } from "@/server/security/request-origin";
import { hasValidSessionCsrfRequest } from "@/server/security/session-csrf";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const HEADERS = { "Cache-Control": "private, no-store" };

export async function GET(request: Request): Promise<Response> {
  const requestId = randomUUID();
  const rawLimit = new URL(request.url).searchParams.get("limit") ?? "20";
  if (!/^[1-9][0-9]?$/.test(rawLimit) || Number(rawLimit) > 50)
    return error(400, "invalid_request", requestId);
  try {
    const client = await createSupabaseServerClient();
    const result = await listIncidentDraftsForCurrentSession(
      client,
      Number(rawLimit),
    );
    if (result.kind === "listed")
      return Response.json(
        {
          data: { drafts: result.drafts },
          meta: { request_id: requestId, api_version: "web-v1" },
        },
        { headers: HEADERS },
      );
    return error(
      result.kind === "denied" ? 401 : 503,
      result.kind === "denied"
        ? "authentication_required"
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
    const [authEnvironment, incidentEnvironment, runtimeEnvironment, client] =
      await Promise.all([
        getAuthServerEnvironment(),
        getIncidentServerEnvironment(),
        getRuntimeEnvironment(),
        createSupabaseServerClient(),
      ]);
    const session = await authorizeCurrentSession(client);
    if (!session.allowed)
      return error(401, "authentication_required", requestId);
    if (
      !isTrustedMutationRequest(request, runtimeEnvironment.APP_ORIGIN) ||
      !hasValidSessionCsrfRequest(
        request.headers,
        session.sessionId,
        authEnvironment.CSRF_HMAC_KEY,
      )
    )
      return error(403, "request_not_allowed", requestId);
    if (!request.headers.get("content-type")?.startsWith("application/json"))
      return error(415, "unsupported_media_type", requestId);
    const body = await readDraftJson(request);
    if (!body.ok) return error(body.status, "invalid_request", requestId);
    const parsed = incidentDraftSaveRequestSchema.safeParse(body.body);
    if (!parsed.success) return error(400, "invalid_request", requestId);
    const result = await saveIncidentDraftForAuthorizedSession(
      parsed.data,
      session,
      client,
      incidentEnvironment.INCIDENT_IDEMPOTENCY_HMAC_KEY,
    );
    if (result.kind === "saved")
      return Response.json(
        {
          data: { draft: result.draft },
          meta: { request_id: requestId, api_version: "web-v1" },
        },
        { headers: HEADERS },
      );
    return error(
      result.kind === "conflict" ? 409 : result.kind === "denied" ? 403 : 503,
      result.kind === "conflict"
        ? "draft_conflict"
        : result.kind === "denied"
          ? "request_not_allowed"
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
    { status, headers: HEADERS },
  );
}
