import "server-only";

import { z } from "zod";

import { isTrustedMutationRequest } from "@/server/security/request-origin";
import { hasValidSessionCsrfRequest } from "@/server/security/session-csrf";

const bodySchema = z
  .object({ revisionNumber: z.number().int().positive() })
  .strict();
const keySchema = z.string().regex(/^[A-Za-z0-9_-]{16,128}$/);

export async function validateDailyPaperworkPrintRequest(
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
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    return { ok: false as const, status: 415, code: "unsupported_media_type" };
  const idempotencyKey = keySchema.safeParse(
    request.headers.get("idempotency-key"),
  );
  if (!idempotencyKey.success)
    return { ok: false as const, status: 400, code: "invalid_request" };
  try {
    const body = bodySchema.safeParse(await request.json());
    return body.success
      ? { ok: true as const, ...body.data, idempotencyKey: idempotencyKey.data }
      : { ok: false as const, status: 400, code: "invalid_request" };
  } catch {
    return { ok: false as const, status: 400, code: "invalid_request" };
  }
}
