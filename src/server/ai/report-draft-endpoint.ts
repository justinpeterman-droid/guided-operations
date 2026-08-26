import "server-only";

import { z } from "zod";

import { reportDraftRequestSchema } from "@/features/incidents/schema";
import { isTrustedMutationRequest } from "@/server/security/request-origin";
import { hasValidSessionCsrfRequest } from "@/server/security/session-csrf";

const idempotencyKeySchema = z.string().regex(/^[A-Za-z0-9_-]{16,128}$/);
const bodySchema = z
  .object({
    request: reportDraftRequestSchema,
    sourceRevisionNumber: z.number().int().positive(),
  })
  .strict();

export type ReportDraftEndpointValidation =
  | Readonly<{
      ok: true;
      request: z.infer<typeof reportDraftRequestSchema>;
      sourceRevisionNumber: number;
      idempotencyKey: string;
    }>
  | Readonly<{ ok: false; status: 400 | 403 | 415; code: string }>;

/** Validates the public wire boundary before any report-draft provider call. */
export async function validateReportDraftEndpointRequest(
  request: Request,
  applicationOrigin: string,
  sessionId: string,
  csrfHmacKey: string,
): Promise<ReportDraftEndpointValidation> {
  if (!isTrustedMutationRequest(request, applicationOrigin)) {
    return { ok: false, status: 403, code: "request_not_allowed" };
  }
  if (!hasValidSessionCsrfRequest(request.headers, sessionId, csrfHmacKey)) {
    return { ok: false, status: 403, code: "request_not_allowed" };
  }
  if (!request.headers.get("content-type")?.startsWith("application/json")) {
    return { ok: false, status: 415, code: "unsupported_media_type" };
  }

  const idempotencyKey = idempotencyKeySchema.safeParse(
    request.headers.get("idempotency-key"),
  );
  if (!idempotencyKey.success) {
    return { ok: false, status: 400, code: "invalid_request" };
  }

  try {
    const body = bodySchema.safeParse(await request.json());
    return body.success
      ? {
          ok: true,
          request: body.data.request,
          sourceRevisionNumber: body.data.sourceRevisionNumber,
          idempotencyKey: idempotencyKey.data,
        }
      : { ok: false, status: 400, code: "invalid_request" };
  } catch {
    return { ok: false, status: 400, code: "invalid_request" };
  }
}
