import { randomUUID } from "node:crypto";

import { getAuthServerEnvironment } from "@/lib/env/auth-server";
import { getIncidentServerEnvironment } from "@/lib/env/incident-server";
import { getRuntimeEnvironment } from "@/lib/env/runtime";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createPersistedReportDraftWorkflow } from "@/server/ai/persisted-report-draft-workflow";
import { createOpenAiReportDraftGenerationProvider } from "@/server/ai/providers/openai-report-draft-generation";
import { validateReportDraftEndpointRequest } from "@/server/ai/report-draft-endpoint";
import { authorizeCurrentSession } from "@/server/auth/current-session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const API_VERSION = "web-v1";
const NO_STORE_HEADERS = { "Cache-Control": "private, no-store" };

/** Stores a review-only report draft candidate from selected confirmed facts. */
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

    const validation = await validateReportDraftEndpointRequest(
      request,
      runtimeEnvironment.APP_ORIGIN,
      session.sessionId,
      authEnvironment.CSRF_HMAC_KEY,
    );
    if (!validation.ok) {
      return errorResponse(validation.status, validation.code, requestId);
    }

    const workflow = createPersistedReportDraftWorkflow(
      createOpenAiReportDraftGenerationProvider(),
      { maximumParagraphs: 12, maximumParagraphCharacters: 2_000 },
    );
    const outcome = await workflow.draftAndStore(
      validation.request,
      validation.sourceRevisionNumber,
      validation.idempotencyKey,
      client,
      incidentEnvironment.INCIDENT_IDEMPOTENCY_HMAC_KEY,
    );

    if (outcome.kind === "stored") {
      return Response.json(
        {
          data: { candidateId: outcome.candidateId },
          meta: { request_id: requestId, api_version: API_VERSION },
        },
        { status: 201, headers: NO_STORE_HEADERS },
      );
    }

    if (outcome.kind === "denied") {
      return errorResponse(403, "request_not_allowed", requestId);
    }
    if (outcome.kind === "not_found") {
      return errorResponse(404, "not_found", requestId);
    }
    return errorResponse(503, "service_unavailable", requestId);
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
