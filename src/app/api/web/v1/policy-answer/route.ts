import { randomUUID } from "node:crypto";

import { getAuthServerEnvironment } from "@/lib/env/auth-server";
import { getRuntimeEnvironment } from "@/lib/env/runtime";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createOpenAiGroundedGenerationProvider } from "@/server/ai/providers/openai-grounded-generation";
import { createPolicyAnswerService } from "@/server/ai/policy-answer-service";
import { validatePolicyAnswerEndpointRequest } from "@/server/ai/policy-answer-endpoint";
import { createSupabasePolicyRetrievalProvider } from "@/server/ai/supabase-policy-retrieval";
import { authorizeCurrentSession } from "@/server/auth/current-session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const API_VERSION = "web-v1";
const NO_STORE_HEADERS = { "Cache-Control": "private, no-store" };

/** Returns only citation-validated policy answers for the current session. */
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

    const validation = await validatePolicyAnswerEndpointRequest(
      request,
      runtimeEnvironment.APP_ORIGIN,
      session.sessionId,
      authEnvironment.CSRF_HMAC_KEY,
    );
    if (!validation.ok) {
      return errorResponse(validation.status, validation.code, requestId);
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
      return Response.json(
        {
          data: { outcome },
          meta: { request_id: requestId, api_version: API_VERSION },
        },
        { headers: NO_STORE_HEADERS },
      );
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
