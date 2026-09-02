import { randomUUID } from "node:crypto";
import { z } from "zod";

import { getAuthServerEnvironment } from "@/lib/env/auth-server";
import { getRuntimeEnvironment } from "@/lib/env/runtime";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { authorizeCurrentSession } from "@/server/auth/current-session";
import { hasValidSessionCsrfRequest } from "@/server/security/session-csrf";
import { improvementRpc } from "@/server/feedback/improvement-rpc";

const requestIdSchema = z.uuid();
const bodySchema = z
  .object({ body: z.string().trim().min(1).max(3000) })
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
    const session = await authorizeCurrentSession(client);
    if (!session.allowed) return errorResponse(401, correlationId);
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
    const result = await improvementRpc<string>(
      client,
      "add_improvement_request_message",
      {
        p_request_id: requestId,
        p_body: parsedBody.data.body,
      },
    );
    if (result.error) return errorResponse(403, correlationId);
    return Response.json(
      {
        data: { messageId: result.data },
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
