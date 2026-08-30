import { randomUUID } from "node:crypto";

import { getAuthServerEnvironment } from "@/lib/env/auth-server";
import {
  getRuntimeEnvironment,
  type RuntimeEnvironment,
} from "@/lib/env/runtime";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { authorizeCurrentSession } from "@/server/auth/current-session";
import { validateAnswerReportRequest } from "@/server/feedback/answer-report-endpoint";
import {
  writeSafeOperationalEvent,
  type SafeOperationalEventInput,
} from "@/server/observability/safe-operational-event";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const API_VERSION = "web-v1";
const NO_STORE_HEADERS = { "Cache-Control": "private, no-store" };

/**
 * Records an officer's report that a shown policy answer was wrong or doubtful.
 *
 * Reporting must never be harder than ignoring the problem, so there is no
 * supervisor approval, no mandatory reason, and no confirmation step. The
 * observability event carries counts and outcomes only - never the question,
 * the answer, or any policy text.
 */
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
        {
          event_name: "answer_report.request",
          outcome: "authentication_required",
          request_id: requestId,
          status_code: 401,
          duration_ms: boundedDuration(startedAt),
          environment: appEnvironment,
        },
      );
    }

    const validation = await validateAnswerReportRequest(
      request,
      runtimeEnvironment.APP_ORIGIN,
      session.sessionId,
      authEnvironment.CSRF_HMAC_KEY,
    );
    if (!validation.ok) {
      return observedResponse(
        errorResponse(validation.status, validation.code, requestId),
        {
          event_name: "answer_report.request",
          outcome: "validation_rejected",
          request_id: requestId,
          status_code: validation.status,
          duration_ms: boundedDuration(startedAt),
          environment: appEnvironment,
        },
      );
    }

    const result = await client.rpc("report_policy_answer", {
      p_question: validation.question,
      p_answer_text: validation.answerText,
      p_citations: validation.citations,
      // The RPC maps an empty string to null (nullif), so an unset corpus
      // version stores as null rather than an empty label.
      p_corpus_version: process.env.RAG_CORPUS_VERSION ?? "",
    });

    if (result.error) {
      return observedResponse(
        errorResponse(503, "service_unavailable", requestId),
        {
          event_name: "answer_report.request",
          outcome: "storage_unavailable",
          request_id: requestId,
          status_code: 503,
          duration_ms: boundedDuration(startedAt),
          environment: appEnvironment,
        },
      );
    }

    return observedResponse(
      Response.json(
        {
          data: { recorded: true },
          meta: { request_id: requestId, api_version: API_VERSION },
        },
        { status: 201, headers: NO_STORE_HEADERS },
      ),
      {
        event_name: "answer_report.request",
        outcome: "recorded",
        request_id: requestId,
        status_code: 201,
        duration_ms: boundedDuration(startedAt),
        environment: appEnvironment,
        citation_count: validation.citations.length,
      },
    );
  } catch {
    const response = errorResponse(503, "service_unavailable", requestId);
    return appEnvironment
      ? observedResponse(response, {
          event_name: "answer_report.request",
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
