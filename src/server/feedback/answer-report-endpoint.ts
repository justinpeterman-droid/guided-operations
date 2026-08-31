import "server-only";

import { z } from "zod";

import type { Json } from "@/lib/supabase/database.generated";
import { hasValidSessionCsrfRequest } from "@/server/security/session-csrf";

/**
 * A report carries the answer and citations exactly as the officer saw them.
 * Re-deriving them later is impossible: the corpus is refreshed annually and
 * retrieval may not reproduce the same answer by the time a report is reviewed.
 * Without the shown text, a report cannot be investigated.
 */
const citationSchema = z
  .object({
    documentVersionId: z.string().trim().min(1).max(200),
    title: z.string().trim().min(1).max(400),
    collection: z.string().trim().min(1).max(120),
  })
  .passthrough();

const MAX_CITATIONS_BYTES = 64 * 1024;
const MAX_CITATION_DEPTH = 3;
const MAX_OPTIONAL_STRING_LENGTH = 8_000;
const MAX_CONTAINER_ITEMS = 50;
const MAX_OPTIONAL_KEY_LENGTH = 120;

function isBoundedCitationValue(value: unknown, depth = 0): boolean {
  if (depth > MAX_CITATION_DEPTH) return false;
  if (value === null || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value === "string") {
    return value.length <= MAX_OPTIONAL_STRING_LENGTH;
  }
  if (Array.isArray(value)) {
    return (
      value.length <= MAX_CONTAINER_ITEMS &&
      value.every((entry) => isBoundedCitationValue(entry, depth + 1))
    );
  }
  if (typeof value !== "object") return false;
  const entries = Object.entries(value);
  return (
    entries.length <= MAX_CONTAINER_ITEMS &&
    entries.every(
      ([key, entry]) =>
        key.length <= MAX_OPTIONAL_KEY_LENGTH &&
        isBoundedCitationValue(entry, depth + 1),
    )
  );
}

function citationsAreBounded(citations: unknown[]): boolean {
  return (
    citations.every((citation) => isBoundedCitationValue(citation)) &&
    new TextEncoder().encode(JSON.stringify(citations)).byteLength <=
      MAX_CITATIONS_BYTES
  );
}

const requestSchema = z
  .object({
    question: z.string().trim().min(3).max(2_000),
    answerText: z.string().trim().min(1).max(20_000),
    citations: z.array(citationSchema).max(20).default([]),
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
    return parsed.success && citationsAreBounded(parsed.data.citations)
      ? {
          ok: true,
          question: parsed.data.question,
          answerText: parsed.data.answerText,
          // Citations came straight out of request.json(), so they are JSON by
          // construction. The schema passes unknown keys through on purpose:
          // page labels and snippets are what make a report investigable, and
          // stripping them would defeat the point of storing what was shown.
          citations: parsed.data.citations as Json[],
        }
      : { ok: false, status: 400, code: "invalid_request" };
  } catch {
    return { ok: false, status: 400, code: "invalid_request" };
  }
}
