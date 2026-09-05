import { createHash, randomUUID } from "node:crypto";

import { z } from "zod";

import { getAuthServerEnvironment } from "@/lib/env/auth-server";
import { getRuntimeEnvironment } from "@/lib/env/runtime";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { authorizeCurrentSession } from "@/server/auth/current-session";
import { MAX_FORM_CANDIDATE_BYTES } from "@/server/feedback/improvement-request-endpoint";
import { createPrivateImprovementStore } from "@/server/feedback/private-improvement-store";
import { hasValidSessionCsrfRequest } from "@/server/security/session-csrf";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const API_VERSION = "web-v1";
const NO_STORE_HEADERS = { "Cache-Control": "private, no-store" };
const FORM_CANDIDATE_BUCKET = "form-candidate-quarantine";
const requestIdSchema = z.uuid();

/** Validates the direct-to-Storage upload before making a form candidate reviewable. */
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
    if (!requestIdSchema.safeParse(requestId).success) {
      return errorResponse(400, "invalid_request", correlationId);
    }

    const session = await authorizeCurrentSession(client);
    if (!session.allowed) {
      return errorResponse(401, "authentication_required", correlationId);
    }
    if (request.headers.get("origin") !== runtimeEnvironment.APP_ORIGIN) {
      return errorResponse(403, "invalid_origin", correlationId);
    }
    if (
      !hasValidSessionCsrfRequest(
        request.headers,
        session.sessionId,
        authEnvironment.CSRF_HMAC_KEY,
      )
    ) {
      return errorResponse(403, "csrf_failed", correlationId);
    }

    const store = createPrivateImprovementStore();
    const candidate = await store.getFormCandidateForUpload(
      requestId,
      session.account.authUserId,
      session.account.facilityId,
    );
    if (!candidate) return errorResponse(404, "not_found", correlationId);
    // Only the authorized owner's unexpired, already integrity-verified upload
    // can reach this branch. A lost response must not require another upload.
    if (candidate.uploadState === "uploaded")
      return finalizedResponse(correlationId);

    const download = await client.storage
      .from(FORM_CANDIDATE_BUCKET)
      .download(candidate.storagePath);
    if (download.error) {
      return errorResponse(409, "upload_not_ready", correlationId);
    }

    const bytes = Buffer.from(await download.data.arrayBuffer());
    const actualMediaType = detectMediaType(bytes, candidate.declaredMediaType);
    const actualSha256 = createHash("sha256").update(bytes).digest("hex");
    if (
      bytes.byteLength < 1 ||
      bytes.byteLength > MAX_FORM_CANDIDATE_BYTES ||
      !actualMediaType ||
      actualMediaType !== candidate.declaredMediaType ||
      bytes.byteLength !== candidate.declaredByteSize ||
      actualSha256 !== candidate.declaredSha256
    ) {
      return errorResponse(400, "upload_integrity_failed", correlationId);
    }

    await store.finalizeFormCandidate(
      requestId,
      session.account.authUserId,
      bytes.byteLength,
      actualSha256,
      actualMediaType,
    );

    return finalizedResponse(correlationId);
  } catch {
    return errorResponse(503, "service_unavailable", correlationId);
  }
}

function finalizedResponse(requestId: string) {
  return Response.json(
    {
      data: { finalized: true },
      meta: { request_id: requestId, api_version: API_VERSION },
    },
    { status: 200, headers: NO_STORE_HEADERS },
  );
}

function detectMediaType(
  bytes: Buffer,
  declaredMediaType: string,
): string | null {
  if (bytes.subarray(0, 5).toString("ascii") === "%PDF-") {
    return "application/pdf";
  }
  if (
    bytes.length >= 8 &&
    bytes
      .subarray(0, 8)
      .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return "image/png";
  }
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  ) {
    return "image/jpeg";
  }
  if (
    bytes.length >= 4 &&
    bytes[0] === 0x50 &&
    bytes[1] === 0x4b &&
    bytes[2] === 0x03 &&
    bytes[3] === 0x04 &&
    (declaredMediaType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      declaredMediaType ===
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
  ) {
    // OOXML is a ZIP container. It remains quarantined and is never parsed,
    // rendered, or published here; deeper template validation is separate.
    return declaredMediaType;
  }
  return null;
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
