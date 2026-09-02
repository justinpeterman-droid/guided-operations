import { randomUUID } from "node:crypto";

import { getAuthServerEnvironment } from "@/lib/env/auth-server";
import { getRuntimeEnvironment } from "@/lib/env/runtime";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { authorizeCurrentSession } from "@/server/auth/current-session";
import { validateImprovementRequest } from "@/server/feedback/improvement-request-endpoint";
import { createPrivateImprovementStore } from "@/server/feedback/private-improvement-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const API_VERSION = "web-v1";
const NO_STORE_HEADERS = { "Cache-Control": "private, no-store" };
const FORM_CANDIDATE_BUCKET = "form-candidate-quarantine";

/** Creates a private feedback request and, when needed, one short-lived upload URL. */
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

    const validation = await validateImprovementRequest(
      request,
      runtimeEnvironment.APP_ORIGIN,
      session.sessionId,
      authEnvironment.CSRF_HMAC_KEY,
    );
    if (!validation.ok) {
      return errorResponse(validation.status, validation.code, requestId);
    }

    const command = validation.command;
    const result = await client.rpc("create_improvement_request", {
      p_request_nonce: command.requestNonce,
      p_request_kind: command.requestKind,
      p_category: command.category,
      p_description: command.description,
      p_route_path: command.routePath ?? null,
      p_target_id: command.target?.id ?? null,
      p_target_role: command.target?.role ?? null,
      p_target_label: command.target?.label ?? null,
      p_viewport_width: command.viewport?.width ?? null,
      p_viewport_height: command.viewport?.height ?? null,
      p_form_title: command.form?.title ?? null,
      p_source_authority: command.form?.sourceAuthority ?? null,
      p_source_revision: command.form?.sourceRevision ?? null,
      p_requested_use: command.form?.requestedUse ?? null,
      p_file_name: command.file?.name ?? null,
      p_file_media_type: command.file?.mediaType ?? null,
      p_file_byte_size: command.file?.byteSize ?? null,
      p_file_sha256: command.file?.sha256 ?? null,
    });
    if (result.error || !result.data?.[0]) {
      return hasDatabaseCode(result.error, "54000")
        ? errorResponse(
            429,
            "request_limit_reached",
            requestId,
            "Too many suggestions were sent recently. Try again later.",
            { "Retry-After": "3600" },
          )
        : errorResponse(503, "service_unavailable", requestId);
    }

    const created = result.data[0];
    await createPrivateImprovementStore().recordReleaseSha(
      created.request_id,
      session.account.authUserId,
      process.env.VERCEL_GIT_COMMIT_SHA,
    );

    let signedUploadUrl: string | null = null;
    if (created.upload_path) {
      const upload = await client.storage
        .from(FORM_CANDIDATE_BUCKET)
        .createSignedUploadUrl(created.upload_path, { upsert: false });
      if (upload.error || !upload.data?.signedUrl) {
        return errorResponse(503, "upload_unavailable", requestId);
      }
      signedUploadUrl = upload.data.signedUrl;
    }

    return Response.json(
      {
        data: {
          requestId: created.request_id,
          signedUploadUrl,
        },
        meta: { request_id: requestId, api_version: API_VERSION },
      },
      { status: 201, headers: NO_STORE_HEADERS },
    );
  } catch {
    return errorResponse(503, "service_unavailable", requestId);
  }
}

function hasDatabaseCode(error: unknown, code: string): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === code
  );
}

function errorResponse(
  status: number,
  code: string,
  requestId: string,
  message = "Request could not be completed.",
  headers: Record<string, string> = {},
): Response {
  return Response.json(
    {
      error: { code, message },
      meta: { request_id: requestId, api_version: API_VERSION },
    },
    { status, headers: { ...NO_STORE_HEADERS, ...headers } },
  );
}
