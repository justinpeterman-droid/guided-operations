import { randomUUID } from "node:crypto";

import { getAuthServerEnvironment } from "@/lib/env/auth-server";
import { getIncidentServerEnvironment } from "@/lib/env/incident-server";
import {
  getRuntimeEnvironment,
  type RuntimeEnvironment,
} from "@/lib/env/runtime";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createPersistedReportDraftWorkflow } from "@/server/ai/persisted-report-draft-workflow";
import { createOpenAiReportDraftGenerationProvider } from "@/server/ai/providers/openai-report-draft-generation";
import { validateReportDraftEndpointRequest } from "@/server/ai/report-draft-endpoint";
import { authorizeCurrentSession } from "@/server/auth/current-session";
import {
  writeSafeOperationalEvent,
  type SafeOperationalEventInput,
} from "@/server/observability/safe-operational-event";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const API_VERSION = "web-v1";
const NO_STORE_HEADERS = { "Cache-Control": "private, no-store" };

/** Stores a review-only report draft candidate from selected confirmed facts. */
export async function POST(request: Request): Promise<Response> {
  const requestId = randomUUID();
  const startedAt = Date.now();
  let appEnvironment: RuntimeEnvironment["APP_ENV"] | undefined;

  try {
    const [authEnvironment, incidentEnvironment, runtimeEnvironment, client] =
      await Promise.all([
        getAuthServerEnvironment(),
        getIncidentServerEnvironment(),
        getRuntimeEnvironment(),
        createSupabaseServerClient(),
      ]);
    appEnvironment = runtimeEnvironment.APP_ENV;
    const session = await authorizeCurrentSession(client);
    if (!session.allowed) {
      return observedResponse(
        errorResponse(401, "authentication_required", requestId),
        {
          event_name: "report_draft.request",
          outcome: "authentication_required",
          request_id: requestId,
          status_code: 401,
          duration_ms: boundedDuration(startedAt),
          environment: appEnvironment,
        },
      );
    }

    const validation = await validateReportDraftEndpointRequest(
      request,
      runtimeEnvironment.APP_ORIGIN,
      session.sessionId,
      authEnvironment.CSRF_HMAC_KEY,
    );
    if (!validation.ok) {
      return observedResponse(
        errorResponse(validation.status, validation.code, requestId),
        {
          event_name: "report_draft.request",
          outcome: "validation_rejected",
          request_id: requestId,
          status_code: validation.status,
          duration_ms: boundedDuration(startedAt),
          environment: appEnvironment,
        },
      );
    }

    const workflow = createPersistedReportDraftWorkflow(
      createOpenAiReportDraftGenerationProvider({
        accountId: session.account.authUserId,
      }),
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
      return observedResponse(
        Response.json(
          {
            data: { candidateId: outcome.candidateId },
            meta: { request_id: requestId, api_version: API_VERSION },
          },
          { status: 201, headers: NO_STORE_HEADERS },
        ),
        {
          event_name: "report_draft.request",
          outcome: "stored",
          request_id: requestId,
          status_code: 201,
          duration_ms: boundedDuration(startedAt),
          environment: appEnvironment,
        },
      );
    }

    if (outcome.kind === "denied") {
      return observedResponse(
        errorResponse(403, "request_not_allowed", requestId),
        {
          event_name: "report_draft.request",
          outcome: "request_not_allowed",
          request_id: requestId,
          status_code: 403,
          duration_ms: boundedDuration(startedAt),
          environment: appEnvironment,
        },
      );
    }
    if (outcome.kind === "not_found") {
      return observedResponse(errorResponse(404, "not_found", requestId), {
        event_name: "report_draft.request",
        outcome: "not_found",
        request_id: requestId,
        status_code: 404,
        duration_ms: boundedDuration(startedAt),
        environment: appEnvironment,
      });
    }
    const budgetUnavailable =
      outcome.kind === "provider_unavailable" &&
      (outcome.reasonCode === "budget_exhausted" ||
        outcome.reasonCode === "budget_check_failed" ||
        outcome.reasonCode === "generation_disabled");
    return observedResponse(
      errorResponse(
        503,
        budgetUnavailable
          ? "ai_temporarily_unavailable"
          : "service_unavailable",
        requestId,
        budgetUnavailable
          ? "AI assistance is temporarily unavailable. Your other site tools still work."
          : undefined,
      ),
      {
        event_name: "report_draft.request",
        outcome:
          outcome.kind === "unavailable"
            ? "service_unavailable"
            : "provider_unavailable",
        reason_code:
          outcome.kind === "invalid_output"
            ? "invalid_output"
            : outcome.kind === "provider_unavailable"
              ? outcome.reasonCode
              : "persistence_failed",
        request_id: requestId,
        status_code: 503,
        duration_ms: boundedDuration(startedAt),
        environment: appEnvironment,
      },
    );
  } catch {
    const response = errorResponse(503, "service_unavailable", requestId);
    return appEnvironment
      ? observedResponse(response, {
          event_name: "report_draft.request",
          outcome: "service_unavailable",
          reason_code: "unhandled_failure",
          request_id: requestId,
          status_code: 503,
          duration_ms: boundedDuration(startedAt),
          environment: appEnvironment,
        })
      : response;
  }
}

function boundedDuration(startedAt: number): number {
  return Math.min(3_600_000, Math.max(0, Date.now() - startedAt));
}

function observedResponse(
  response: Response,
  event: SafeOperationalEventInput,
): Response {
  writeSafeOperationalEvent(event);
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
