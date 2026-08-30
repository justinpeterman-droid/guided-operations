import "server-only";
import { z } from "zod";
import { isTrustedMutationRequest } from "@/server/security/request-origin";
import { hasValidSessionCsrfRequest } from "@/server/security/session-csrf";
const body = z
  .object({
    baseRevisionNumber: z.number().int().positive(),
    narrative: z.string().trim().min(1).max(50_000),
    reason: z.string().trim().min(1).max(500),
  })
  .strict();
export async function validateReportRevisionRequest(
  r: Request,
  o: string,
  s: string,
  k: string,
) {
  if (
    !isTrustedMutationRequest(r, o) ||
    !hasValidSessionCsrfRequest(r.headers, s, k)
  )
    return { ok: false as const, status: 403, code: "request_not_allowed" };
  if (!r.headers.get("content-type")?.startsWith("application/json"))
    return { ok: false as const, status: 415, code: "unsupported_media_type" };
  const key = z
    .string()
    .regex(/^[A-Za-z0-9_-]{16,128}$/)
    .safeParse(r.headers.get("idempotency-key"));
  if (!key.success)
    return { ok: false as const, status: 400, code: "invalid_request" };
  try {
    const p = body.safeParse(await r.json());
    return p.success
      ? { ok: true as const, ...p.data, idempotencyKey: key.data }
      : { ok: false as const, status: 400, code: "invalid_request" };
  } catch {
    return { ok: false as const, status: 400, code: "invalid_request" };
  }
}
