import { randomUUID } from "node:crypto";

import { getAuthServerEnvironment } from "@/lib/env/auth-server";
import {
  getRuntimeEnvironment,
  type RuntimeEnvironment,
} from "@/lib/env/runtime";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createIncidentFactExtractionService } from "@/server/ai/incident-fact-extraction-service";
import { validateIncidentFactExtractionEndpointRequest } from "@/server/ai/incident-fact-extraction-endpoint";
import { createOpenAiIncidentFactExtractionProvider } from "@/server/ai/providers/openai-incident-fact-extraction";
import { authorizeCurrentSession } from "@/server/auth/current-session";
import {
  writeSafeOperationalEvent,
  type SafeOperationalEventInput,
} from "@/server/observability/safe-operational-event";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const API_VERSION = "web-v1";
const NO_STORE_HEADERS = { "Cache-Control": "private, no-store" };

/** Returns review-only suggestions and never writes or confirms an incident. */
export async function POST(request: Request): Promise<Response> {
  const requestId = randomUUID();
  const startedAt = Date.now();
  let appEnvironment: RuntimeEnvironment["APP_ENV"] | undefined;

  try {
    const [authEnvironment, runtimeEnvironment, client] = await Promise.all([
      getAuthServerEnvironment(),
      getRuntimeEnvironment(),
      createSupabaseServerClient(),
    ]);
    appEnvironment = runtimeEnvironment.APP_ENV;
    const session = await authorizeCurrentSession(client);
    if (!session.allowed) {
      return observedResponse(
        errorResponse(401, "authentication_required", requestId),
        event(
          "authentication_required",
          401,
          requestId,
          startedAt,
          appEnvironment,
        ),
      );
    }

    const validation = await validateIncidentFactExtractionEndpointRequest(
      request,
      runtimeEnvironment.APP_ORIGIN,
      session.sessionId,
      authEnvironment.CSRF_HMAC_KEY,
    );
    if (!validation.ok) {
      return observedResponse(
        errorResponse(validation.status, validation.code, requestId),
        event(
          "validation_rejected",
          validation.status,
          requestId,
          startedAt,
          appEnvironment,
        ),
      );
    }

    const service = createIncidentFactExtractionService(
      createOpenAiIncidentFactExtractionProvider({
        accountId: session.account.authUserId,
      }),
    );
    const outcome = await service.suggest(validation.notes);
    if (outcome.kind === "suggested") {
      return observedResponse(
        Response.json(
          {
            data: outcome.result,
            meta: { request_id: requestId, api_version: API_VERSION },
          },
          { headers: NO_STORE_HEADERS },
        ),
        event("suggested", 200, requestId, startedAt, appEnvironment),
      );
    }

    const invalid =
      outcome.kind === "invalid_source" || outcome.kind === "invalid_output";
    const reasonCode =
      outcome.kind === "provider_unavailable"
        ? outcome.reasonCode
        : outcome.kind;
    return observedResponse(
      errorResponse(
        invalid ? 400 : 503,
        invalid ? "invalid_request" : "ai_temporarily_unavailable",
        requestId,
        invalid
          ? "The notes could not be turned into safe suggestions. Use manual review."
          : "AI suggestions are unavailable. Use manual review.",
      ),
      event(
        invalid ? "invalid_suggestion" : "provider_unavailable",
        invalid ? 400 : 503,
        requestId,
        startedAt,
        appEnvironment,
        reasonCode,
      ),
    );
  } catch {
    const response = errorResponse(503, "service_unavailable", requestId);
    return appEnvironment
      ? observedResponse(
          response,
          event(
            "service_unavailable",
            503,
            requestId,
            startedAt,
            appEnvironment,
            "unhandled_failure",
          ),
        )
      : response;
  }
}

function event(
  outcome: SafeOperationalEventInput["outcome"],
  statusCode: number,
  requestId: string,
  startedAt: number,
  environment: RuntimeEnvironment["APP_ENV"],
  reasonCode?: SafeOperationalEventInput["reason_code"],
): SafeOperationalEventInput {
  return {
    event_name: "incident_fact_extraction.request",
    outcome,
    ...(reasonCode ? { reason_code: reasonCode } : {}),
    request_id: requestId,
    status_code: statusCode,
    duration_ms: Math.min(3_600_000, Math.max(0, Date.now() - startedAt)),
    environment,
  };
}

function observedResponse(
  response: Response,
  operationalEvent: SafeOperationalEventInput,
): Response {
  writeSafeOperationalEvent(operationalEvent);
  return response;
}

function errorResponse(
  status: number,
  code: string,
  requestId: string,
  message = "Request could not be completed.",
): Response {
  return Response.json(
    {
      error: { code, message },
      meta: { request_id: requestId, api_version: API_VERSION },
    },
    { status, headers: NO_STORE_HEADERS },
  );
}
