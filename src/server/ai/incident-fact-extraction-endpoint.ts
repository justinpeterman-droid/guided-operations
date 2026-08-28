import "server-only";

import { z } from "zod";

import { isTrustedMutationRequest } from "@/server/security/request-origin";
import { hasValidSessionCsrfRequest } from "@/server/security/session-csrf";

const bodySchema = z
  .object({ notes: z.string().trim().min(1).max(20_000) })
  .strict();

export type IncidentFactExtractionEndpointValidation =
  | Readonly<{ ok: true; notes: string }>
  | Readonly<{ ok: false; status: 400 | 403 | 415; code: string }>;

export async function validateIncidentFactExtractionEndpointRequest(
  request: Request,
  applicationOrigin: string,
  sessionId: string,
  csrfHmacKey: string,
): Promise<IncidentFactExtractionEndpointValidation> {
  if (!isTrustedMutationRequest(request, applicationOrigin)) {
    return { ok: false, status: 403, code: "request_not_allowed" };
  }
  if (!hasValidSessionCsrfRequest(request.headers, sessionId, csrfHmacKey)) {
    return { ok: false, status: 403, code: "request_not_allowed" };
  }
  if (!request.headers.get("content-type")?.startsWith("application/json")) {
    return { ok: false, status: 415, code: "unsupported_media_type" };
  }
  try {
    const body = bodySchema.safeParse(await request.json());
    return body.success
      ? { ok: true, notes: body.data.notes }
      : { ok: false, status: 400, code: "invalid_request" };
  } catch {
    return { ok: false, status: 400, code: "invalid_request" };
  }
}
