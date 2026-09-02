import { randomUUID } from "node:crypto";
import { z } from "zod";

import { getAuthServerEnvironment } from "@/lib/env/auth-server";
import { getRuntimeEnvironment } from "@/lib/env/runtime";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { authorizeCurrentSession } from "@/server/auth/current-session";
import { hasValidSessionCsrfRequest } from "@/server/security/session-csrf";

const requestIdSchema = z.uuid();
const bodySchema = z
  .object({
    nextStatus: z.enum([
      "under_review",
      "needs_information",
      "planned",
      "ready_for_publication",
      "completed",
      "declined",
    ]),
    reasonCode: z.enum([
      "review_started",
      "follow_up_needed",
      "planned",
      "form_ready_for_publication",
      "resolved",
      "declined",
    ]),
    followUpMessage: z.string().trim().min(1).max(3000).optional(),
  })
  .strict();

export async function POST(
  request: Request,
  context: { params: Promise<{ requestId: string }> },
): Promise<Response> {
  const correlationId = randomUUID();
  try {
    const [{ requestId }, authEnvironment, runtimeEnvironment, client] =
      await Promise.all([
        context.params,
        getAuthServerEnvironment(),
        getRuntimeEnvironment(),
        createSupabaseServerClient(),
      ]);
    const session = await authorizeCurrentSession(client, {
      requiredRole: "administrator",
    });
    if (!session.allowed) return errorResponse(403, correlationId);
    if (
      request.headers.get("origin") !== runtimeEnvironment.APP_ORIGIN ||
      !hasValidSessionCsrfRequest(
        request.headers,
        session.sessionId,
        authEnvironment.CSRF_HMAC_KEY,
      )
    )
      return errorResponse(403, correlationId);
    const parsedRequestId = requestIdSchema.safeParse(requestId);
    const parsedBody = bodySchema.safeParse(await request.json());
    if (!parsedRequestId.success || !parsedBody.success)
      return errorResponse(400, correlationId);
    const body = parsedBody.data;
    const result = await client.rpc("transition_improvement_request", {
      p_request_id: requestId,
      p_next_status: body.nextStatus,
      p_reason_code: body.reasonCode,
      p_follow_up_message: body.followUpMessage ?? null,
    });
    if (result.error || !result.data) return errorResponse(403, correlationId);
    return Response.json(
      {
        data: { transitioned: true },
        meta: { request_id: correlationId, api_version: "web-v1" },
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch {
    return errorResponse(503, correlationId);
  }
}

function errorResponse(status: number, requestId: string) {
  return Response.json(
    {
      error: {
        code: "request_failed",
        message: "Request could not be completed.",
      },
      meta: { request_id: requestId, api_version: "web-v1" },
    },
    { status, headers: { "Cache-Control": "private, no-store" } },
  );
}
