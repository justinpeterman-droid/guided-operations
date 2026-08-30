import "server-only";

import { z } from "zod";

import { isTrustedMutationRequest } from "@/server/security/request-origin";
import { hasValidSessionCsrfRequest } from "@/server/security/session-csrf";

const keySchema = z.string().regex(/^[A-Za-z0-9_-]{16,128}$/);
const canonicalRevision = /^[1-9][0-9]{0,8}$/;

export async function validateReportDocxExportRequest(
  request: Request,
  appOrigin: string,
  sessionId: string,
  csrfHmacKey: string,
) {
  if (
    !isTrustedMutationRequest(request, appOrigin) ||
    !hasValidSessionCsrfRequest(request.headers, sessionId, csrfHmacKey)
  )
    return { ok: false as const, status: 403, code: "request_not_allowed" };

  const url = new URL(request.url);
  if (
    [...url.searchParams.keys()].some((key) => key !== "revision") ||
    url.searchParams.getAll("revision").length !== 1
  )
    return { ok: false as const, status: 400, code: "invalid_request" };
  const revision = url.searchParams.get("revision") ?? "";
  const idempotencyKey = keySchema.safeParse(
    request.headers.get("idempotency-key"),
  );
  if (!canonicalRevision.test(revision) || !idempotencyKey.success)
    return { ok: false as const, status: 400, code: "invalid_request" };

  const contentLength = request.headers.get("content-length");
  if (contentLength !== null && contentLength !== "0")
    return { ok: false as const, status: 400, code: "invalid_request" };
  try {
    if (request.body) {
      const reader = request.body.getReader();
      const first = await reader.read();
      await reader.cancel();
      if (!first.done || (first.value?.byteLength ?? 0) !== 0)
        return { ok: false as const, status: 400, code: "invalid_request" };
    }
  } catch {
    return { ok: false as const, status: 400, code: "invalid_request" };
  }

  return {
    ok: true as const,
    revisionNumber: Number(revision),
    idempotencyKey: idempotencyKey.data,
  };
}
