import "server-only";

import { z } from "zod";

import { revisionUsesCandidateReportChecklist } from "@/features/incidents/report-assistant-checklist";
import { createIncidentRequestSchema } from "@/features/incidents/commands";
import { isTrustedMutationRequest } from "@/server/security/request-origin";
import { hasValidSessionCsrfRequest } from "@/server/security/session-csrf";

const idempotencyKeySchema = z.string().regex(/^[A-Za-z0-9_-]{16,128}$/);
export type ValidatedCreateIncidentRequest = Readonly<{
  revision: z.infer<typeof createIncidentRequestSchema>["revision"];
  staffRelationships: z.infer<
    typeof createIncidentRequestSchema
  >["staffRelationships"];
  idempotencyKey: string;
}>;

export type CreateIncidentRequestValidation =
  | Readonly<{ ok: true; command: ValidatedCreateIncidentRequest }>
  | Readonly<{ ok: false; status: number; code: string }>;

/**
 * Validates an untrusted browser mutation after the handler has established a
 * current session. Identity, role, and facility are intentionally absent from
 * this wire contract and are derived server-side.
 */
export async function validateCreateIncidentEndpointRequest(
  request: Request,
  applicationOrigin: string,
  sessionId: string,
  csrfHmacKey: string,
  applicationEnvironment: "development" | "preview" | "production" | "test",
): Promise<CreateIncidentRequestValidation> {
  if (!isTrustedMutationRequest(request, applicationOrigin)) {
    return { ok: false, status: 403, code: "request_not_allowed" };
  }

  if (!hasValidSessionCsrfRequest(request.headers, sessionId, csrfHmacKey)) {
    return { ok: false, status: 403, code: "request_not_allowed" };
  }

  if (!request.headers.get("content-type")?.startsWith("application/json")) {
    return { ok: false, status: 415, code: "unsupported_media_type" };
  }

  const idempotency = idempotencyKeySchema.safeParse(
    request.headers.get("idempotency-key"),
  );
  if (!idempotency.success) {
    return { ok: false, status: 400, code: "invalid_request" };
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return { ok: false, status: 400, code: "invalid_request" };
  }

  const parsed = createIncidentRequestSchema.safeParse(body);
  if (!parsed.success) {
    return { ok: false, status: 400, code: "invalid_request" };
  }
  if (
    applicationEnvironment === "production" &&
    revisionUsesCandidateReportChecklist(parsed.data.revision.reviewedFacts)
  ) {
    return { ok: false, status: 403, code: "checklist_not_approved" };
  }

  return {
    ok: true,
    command: {
      revision: parsed.data.revision,
      staffRelationships: parsed.data.staffRelationships,
      idempotencyKey: idempotency.data,
    },
  };
}
