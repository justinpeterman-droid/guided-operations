import "server-only";

import { z } from "zod";

import {
  dailyPaperworkKindSchema,
  shiftCodeSchema,
} from "@/features/daily-paperwork/catalog";
import { isTrustedMutationRequest } from "@/server/security/request-origin";
import { hasValidSessionCsrfRequest } from "@/server/security/session-csrf";

const bodySchema = z
  .object({
    kind: dailyPaperworkKindSchema,
    workDate: z.iso.date(),
    shiftCode: shiftCodeSchema,
    baseRevisionNumber: z.number().int().min(0),
    payload: z.unknown(),
    reason: z.string().trim().min(1).max(500),
  })
  .strict();

export async function validateDailyPaperworkSaveRequest(
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
  const contentLength = z.coerce
    .number()
    .int()
    .min(0)
    .max(1_000_000)
    .safeParse(request.headers.get("content-length") ?? "0");
  if (!contentLength.success)
    return { ok: false as const, status: 413, code: "request_too_large" };

  const idempotencyKey = z
    .string()
    .regex(/^[A-Za-z0-9_-]{16,128}$/)
    .safeParse(request.headers.get("idempotency-key"));
  if (!idempotencyKey.success)
    return { ok: false as const, status: 400, code: "invalid_request" };

  try {
    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > 1_000_000)
      return { ok: false as const, status: 413, code: "request_too_large" };
    const body = bodySchema.safeParse(JSON.parse(rawBody));
    return body.success
      ? { ok: true as const, ...body.data, idempotencyKey: idempotencyKey.data }
      : { ok: false as const, status: 400, code: "invalid_request" };
  } catch {
    return { ok: false as const, status: 400, code: "invalid_request" };
  }
}
