import { randomUUID } from "node:crypto";

import { getRuntimeEnvironment } from "@/lib/env/runtime";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { authorizeCurrentSession } from "@/server/auth/current-session";
import { writeSafeOperationalEvent } from "@/server/observability/safe-operational-event";
import {
  getAuthorizedPolicySource,
  readAuthorizedPolicySourcePdf,
} from "@/server/policy/policy-source-reader";
import { createSupabasePolicySourceStorageReader } from "@/server/policy/supabase-policy-source-storage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const API_VERSION = "web-v1";
const NO_STORE_HEADERS = { "Cache-Control": "private, no-store, max-age=0" };

/** Serves one approved immutable policy PDF after session and source checks. */
export async function GET(
  _request: Request,
  context: Readonly<{
    params: Promise<Readonly<{ documentVersionId: string }>>;
  }>,
): Promise<Response> {
  const requestId = randomUUID();
  const startedAt = Date.now();

  try {
    const [{ documentVersionId }, environment, client] = await Promise.all([
      context.params,
      getRuntimeEnvironment(),
      createSupabaseServerClient(),
    ]);
    const session = await authorizeCurrentSession(client);
    if (!session.allowed) {
      recordRead(
        "authentication_required",
        401,
        requestId,
        startedAt,
        environment.APP_ENV,
      );
      return errorResponse(401, "authentication_required", requestId);
    }

    const source = await getAuthorizedPolicySource(client, documentVersionId);
    if (!source) {
      recordRead("not_found", 404, requestId, startedAt, environment.APP_ENV);
      return errorResponse(404, "not_found", requestId);
    }

    const result = await readAuthorizedPolicySourcePdf(
      source,
      createSupabasePolicySourceStorageReader(),
    );
    if (result.kind === "ready") {
      recordRead("served", 200, requestId, startedAt, environment.APP_ENV);
      return new Response(await result.pdf.arrayBuffer(), {
        status: 200,
        headers: {
          ...NO_STORE_HEADERS,
          "Content-Disposition": `inline; filename="${result.filename}"`,
          "Content-Length": String(result.pdf.size),
          "Content-Security-Policy": "sandbox",
          "Content-Type": "application/pdf",
          "Cross-Origin-Resource-Policy": "same-origin",
          "Referrer-Policy": "no-referrer",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }

    const outcome =
      result.kind === "integrity_failure"
        ? "integrity_failed"
        : "storage_unavailable";
    recordRead(outcome, 503, requestId, startedAt, environment.APP_ENV);
    return errorResponse(503, "service_unavailable", requestId);
  } catch {
    recordRead(
      "service_unavailable",
      503,
      requestId,
      startedAt,
      process.env.APP_ENV,
    );
    return errorResponse(503, "service_unavailable", requestId);
  }
}

function recordRead(
  outcome:
    | "authentication_required"
    | "integrity_failed"
    | "not_found"
    | "served"
    | "service_unavailable"
    | "storage_unavailable",
  statusCode: number,
  requestId: string,
  startedAt: number,
  environment: string | undefined,
): void {
  if (
    environment !== "development" &&
    environment !== "preview" &&
    environment !== "production" &&
    environment !== "test"
  ) {
    return;
  }

  writeSafeOperationalEvent({
    event_name: "policy_source.read",
    outcome,
    request_id: requestId,
    status_code: statusCode,
    duration_ms: Math.max(0, Date.now() - startedAt),
    environment,
  });
}

function errorResponse(
  status: number,
  code: "authentication_required" | "not_found" | "service_unavailable",
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
