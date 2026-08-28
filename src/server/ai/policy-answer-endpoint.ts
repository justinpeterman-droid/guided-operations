import "server-only";

import { z } from "zod";

import {
  policyCollectionSchema,
  type PolicyCollection,
} from "@/features/policy/grounding";
import { hasValidSessionCsrfRequest } from "@/server/security/session-csrf";

const requestSchema = z
  .object({
    question: z.string().trim().min(3).max(2_000),
    history: z
      .array(
        z.object({ question: z.string().trim().min(3).max(2_000) }).strict(),
      )
      .max(6)
      .default([]),
    collections: z.array(policyCollectionSchema).min(1).max(3).optional(),
  })
  .strict();

export type PolicyAnswerEndpointValidation =
  | Readonly<{
      ok: true;
      question: string;
      history: readonly Readonly<{ question: string }>[];
      collections?: readonly PolicyCollection[];
    }>
  | Readonly<{
      ok: false;
      status: 400 | 403 | 415;
      code: "invalid_request" | "invalid_origin" | "csrf_failed";
    }>;

/** Validates a same-origin, session-CSRF-protected policy-question request. */
export async function validatePolicyAnswerEndpointRequest(
  request: Request,
  appOrigin: string,
  sessionId: string,
  csrfHmacKey: string,
): Promise<PolicyAnswerEndpointValidation> {
  if (request.headers.get("origin") !== appOrigin) {
    return { ok: false, status: 403, code: "invalid_origin" };
  }
  if (!hasValidSessionCsrfRequest(request.headers, sessionId, csrfHmacKey)) {
    return { ok: false, status: 403, code: "csrf_failed" };
  }
  if (!request.headers.get("content-type")?.includes("application/json")) {
    return { ok: false, status: 415, code: "invalid_request" };
  }

  try {
    const parsed = requestSchema.safeParse(await request.json());
    return parsed.success
      ? {
          ok: true,
          question: parsed.data.question,
          history: parsed.data.history,
          ...(parsed.data.collections
            ? { collections: parsed.data.collections }
            : {}),
        }
      : { ok: false, status: 400, code: "invalid_request" };
  } catch {
    return { ok: false, status: 400, code: "invalid_request" };
  }
}
