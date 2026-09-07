import { randomUUID } from "node:crypto";

import { getAuthServerEnvironment } from "@/lib/env/auth-server";
import { getRuntimeEnvironment } from "@/lib/env/runtime";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { authorizeCurrentSession } from "@/server/auth/current-session";
import {
  discardIncidentDraftForCurrentSession,
  getIncidentDraftForCurrentSession,
} from "@/server/incidents/incident-drafts";
import { isTrustedMutationRequest } from "@/server/security/request-origin";
import { hasValidSessionCsrfRequest } from "@/server/security/session-csrf";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const HEADERS = { "Cache-Control": "private, no-store" };

export async function GET(
  _request: Request,
  context: { params: Promise<{ draftId: string }> },
): Promise<Response> {
  const requestId = randomUUID();
  try {
    const client = await createSupabaseServerClient();
    const { draftId } = await context.params;
    const result = await getIncidentDraftForCurrentSession(draftId, client);
    if (result.kind === "found")
      return Response.json(
        {
          data: { draft: result.draft },
          meta: { request_id: requestId, api_version: "web-v1" },
        },
        { headers: HEADERS },
      );
    return error(
      result.kind === "denied" ? 401 : result.kind === "not_found" ? 404 : 503,
      result.kind === "denied"
        ? "authentication_required"
        : result.kind === "not_found"
          ? "not_found"
          : "service_unavailable",
      requestId,
    );
  } catch {
    return error(503, "service_unavailable", requestId);
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ draftId: string }> },
): Promise<Response> {
  const requestId = randomUUID();
  try {
    const [authEnvironment, runtimeEnvironment, client] = await Promise.all([
      getAuthServerEnvironment(),
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
    const { draftId } = await context.params;
    const revision = Number(new URL(request.url).searchParams.get("revision"));
    if (!Number.isSafeInteger(revision) || revision < 1)
      return error(400, "invalid_request", requestId);
    const result = await discardIncidentDraftForCurrentSession(
      draftId,
      revision,
      client,
    );
    if (result.kind === "discarded")
      return new Response(null, { status: 204, headers: HEADERS });
    return error(
      result.kind === "conflict" ? 409 : result.kind === "denied" ? 404 : 503,
      result.kind === "conflict"
        ? "draft_conflict"
        : result.kind === "denied"
          ? "not_found"
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
