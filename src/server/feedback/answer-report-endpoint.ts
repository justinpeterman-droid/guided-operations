import "server-only";

import { z } from "zod";

import { sourceCitationSchema } from "@/features/policy/grounding";
import type { Json } from "@/lib/supabase/database.generated";
import { hasValidSessionCsrfRequest } from "@/server/security/session-csrf";

export const MAX_ANSWER_REPORT_CITATION_BYTES = 32 * 1024;

/**
 * A report carries the answer and citations exactly as the officer saw them.
 * Re-deriving them later is impossible: the corpus is refreshed annually and
 * retrieval may not reproduce the same answer by the time a report is reviewed.
 * Without the shown text, a report cannot be investigated.
 */
const requestSchema = z
  .object({
    question: z.string().trim().min(3).max(2_000),
    answerText: z.string().trim().min(1).max(20_000),
    citations: z.array(sourceCitationSchema).max(20).default([]),
  })
  .strict();

export type AnswerReportEndpointValidation =
  | Readonly<{
      ok: true;
      question: string;
      answerText: string;
      citations: Json[];
    }>
  | Readonly<{
      ok: false;
      status: 400 | 403 | 415;
      code: "invalid_request" | "invalid_origin" | "csrf_failed";
    }>;

function serializedByteLength(value: unknown): number {
  return new TextEncoder().encode(JSON.stringify(value)).byteLength;
}

/** Validates a same-origin, session-CSRF-protected answer report. */
export async function validateAnswerReportRequest(
  request: Request,
  appOrigin: string,
  sessionId: string,
  csrfHmacKey: string,
): Promise<AnswerReportEndpointValidation> {
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
    if (!parsed.success) {
      return { ok: false, status: 400, code: "invalid_request" };
    }
    if (
      serializedByteLength(parsed.data.citations) >
      MAX_ANSWER_REPORT_CITATION_BYTES
    ) {
      return { ok: false, status: 400, code: "invalid_request" };
    }

    return {
      ok: true,
      question: parsed.data.question,
      answerText: parsed.data.answerText,
      // The strict shared citation schema preserves every provenance field the
      // officer saw while rejecting unknown keys, nested payloads, and
      // unbounded strings before the JSON reaches PostgreSQL.
      citations: parsed.data.citations as Json[],
    };
  } catch {
    return { ok: false, status: 400, code: "invalid_request" };
  }
}
