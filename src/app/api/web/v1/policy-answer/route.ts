import { randomUUID } from "node:crypto";

import { getAuthServerEnvironment } from "@/lib/env/auth-server";
import {
  getRuntimeEnvironment,
  type RuntimeEnvironment,
} from "@/lib/env/runtime";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createOpenAiGroundedGenerationProvider } from "@/server/ai/providers/openai-grounded-generation";
import { createPolicyAnswerService } from "@/server/ai/policy-answer-service";
import { validatePolicyAnswerEndpointRequest } from "@/server/ai/policy-answer-endpoint";
import { createSupabasePolicyRetrievalProvider } from "@/server/ai/supabase-policy-retrieval";
import { authorizeCurrentSession } from "@/server/auth/current-session";
import {
  writeSafeOperationalEvent,
  type SafeOperationalEventInput,
} from "@/server/observability/safe-operational-event";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const API_VERSION = "web-v1";
const NO_STORE_HEADERS = { "Cache-Control": "private, no-store" };

/** Returns only citation-validated policy answers for the current session. */
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
          event_name: "policy_answer.request",
          outcome: "authentication_required",
          request_id: requestId,
          status_code: 401,
          duration_ms: boundedDuration(startedAt),
          environment: appEnvironment,
          corpus_version: process.env.RAG_CORPUS_VERSION,
        },
      );
    }

    const validation = await validatePolicyAnswerEndpointRequest(
      request,
      runtimeEnvironment.APP_ORIGIN,
      session.sessionId,
      authEnvironment.CSRF_HMAC_KEY,
    );
    if (!validation.ok) {
      return observedResponse(
        errorResponse(validation.status, validation.code, requestId),
        {
          event_name: "policy_answer.request",
          outcome: "validation_rejected",
          request_id: requestId,
          status_code: validation.status,
          duration_ms: boundedDuration(startedAt),
          environment: appEnvironment,
          corpus_version: process.env.RAG_CORPUS_VERSION,
        },
      );
    }

    const service = createPolicyAnswerService(
      {
        retrieval: createSupabasePolicyRetrievalProvider(client),
        generation: createOpenAiGroundedGenerationProvider(),
      },
      { maximumPassages: 8, maximumAnswerCharacters: 4_000 },
    );
    const outcome = await service.answer({
      facilityId: session.account.facilityId,
      question: validation.question,
    });

    if (outcome.kind === "answer" || outcome.kind === "insufficient_evidence") {
      return observedResponse(
        Response.json(
          {
            data: { outcome },
            meta: { request_id: requestId, api_version: API_VERSION },
          },
          { headers: NO_STORE_HEADERS },
        ),
        {
          event_name: "policy_answer.request",
          outcome:
            outcome.kind === "answer" ? "answered" : "insufficient_evidence",
          request_id: requestId,
          status_code: 200,
          duration_ms: boundedDuration(startedAt),
          citation_count: outcome.answer.citations.length,
          environment: appEnvironment,
          corpus_version: process.env.RAG_CORPUS_VERSION,
        },
      );
    }

    const budgetUnavailable =
      outcome.reasonCode === "budget_exhausted" ||
      outcome.reasonCode === "budget_check_failed" ||
      outcome.reasonCode === "generation_disabled";
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
        event_name: "policy_answer.request",
        outcome: "provider_unavailable",
        reason_code: outcome.reasonCode,
        request_id: requestId,
        status_code: 503,
        duration_ms: boundedDuration(startedAt),
        environment: appEnvironment,
        corpus_version: process.env.RAG_CORPUS_VERSION,
      },
    );
  } catch {
    const response = errorResponse(503, "service_unavailable", requestId);
    return appEnvironment
      ? observedResponse(response, {
          event_name: "policy_answer.request",
          outcome: "service_unavailable",
          reason_code: "unhandled_failure",
          request_id: requestId,
          status_code: 503,
          duration_ms: boundedDuration(startedAt),
          environment: appEnvironment,
          corpus_version: process.env.RAG_CORPUS_VERSION,
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
