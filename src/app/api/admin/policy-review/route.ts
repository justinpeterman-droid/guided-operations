import { z } from "zod";
import { getAuthServerEnvironment } from "@/lib/env/auth-server";
import { getRuntimeEnvironment } from "@/lib/env/runtime";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { authorizeCurrentSession } from "@/server/auth/current-session";
import { adminStepUpInternals } from "@/server/auth/admin-step-up";
import { createAdminStepUpStore } from "@/server/auth/private-admin-step-up-store";
import { requestAdminStepUp } from "@/server/auth/request-admin-step-up";
import { createSupabaseAdministratorPasscodeVerifier } from "@/server/auth/supabase-auth-adapters";
import { createPolicyReviewStore } from "@/server/ai/private-policy-review-store";
import { policyReviewSchema } from "@/server/ai/policy-review-contract";
import { isTrustedMutationRequest } from "@/server/security/request-origin";
import { hasValidSessionCsrfRequest } from "@/server/security/session-csrf";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const headers = { "Cache-Control": "private, no-store" };
const schema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("prepare"),
      versionId: z.uuid(),
      runId: z.uuid(),
    })
    .strict(),
  z
    .object({
      action: z.literal("approve"),
      review: policyReviewSchema,
      passcode: z.string().min(1).max(64),
    })
    .strict(),
]);

function failure(status: number, error: string) {
  return Response.json({ error }, { status, headers });
}

/** Operator HTTP interface; raw step-up proof never leaves this server request. */
export async function POST(request: Request): Promise<Response> {
  try {
    const runtimeEnvironment = getRuntimeEnvironment();
    if (
      runtimeEnvironment.APP_ENV !== "production" ||
      process.env.POLICY_CORPUS_REVIEW_ENABLED !== "true"
    )
      return failure(404, "not_found");
    const environment = getAuthServerEnvironment();
    const client = await createSupabaseServerClient();
    const session = await authorizeCurrentSession(client, {
      requiredRole: "administrator",
    });
    if (!session.allowed) return failure(401, "authentication_required");
    if (
      !isTrustedMutationRequest(request, runtimeEnvironment.APP_ORIGIN) ||
      !hasValidSessionCsrfRequest(
        request.headers,
        session.sessionId,
        environment.CSRF_HMAC_KEY,
      )
    )
      return failure(403, "request_not_allowed");
    if (!request.headers.get("content-type")?.startsWith("application/json"))
      return failure(400, "invalid_review");
    // Enforce the bound while streaming, before JSON allocation/validation.
    const reader = request.body?.getReader();
    if (!reader) return failure(400, "invalid_review");
    const parts: Uint8Array[] = [];
    let size = 0;
    try {
      while (true) {
        const part = await reader.read();
        if (part.done) break;
        size += part.value.byteLength;
        if (size > 524288) {
          await reader.cancel();
          return failure(413, "invalid_review");
        }
        parts.push(part.value);
      }
    } finally {
      reader.releaseLock();
    }
    let body: unknown;
    try {
      body = JSON.parse(Buffer.concat(parts).toString("utf8"));
    } catch {
      return failure(400, "invalid_review");
    }
    const parsed = schema.safeParse(body);
    if (!parsed.success) return failure(400, "invalid_review");
    const store = createPolicyReviewStore();
    if (parsed.data.action === "prepare") {
      const snapshot = await store.snapshot(
        session,
        parsed.data.versionId,
        parsed.data.runId,
      );
      return Response.json({ data: snapshot }, { headers });
    }
    // A complete manifest alone cannot grant review: require a fresh credential
    // check for this action and consume its proof atomically with exact evidence.
    const proof = await requestAdminStepUp(
      client,
      "policy.review",
      { passcode: parsed.data.passcode },
      {
        verifier: createSupabaseAdministratorPasscodeVerifier(),
        store: createAdminStepUpStore(),
        hmacKey: environment.CSRF_HMAC_KEY,
      },
    );
    if (proof.status === "denied")
      return failure(401, "authentication_required");
    if (proof.status !== "issued") return failure(503, "service_unavailable");
    const tokenDigest = adminStepUpInternals.digestStepUpToken(
      proof.token,
      "policy.review",
      environment.CSRF_HMAC_KEY,
    );
    const status = await store.approve(
      session,
      parsed.data.review,
      proof.requestId,
      tokenDigest,
    );
    return Response.json({ data: { status, searchable: false } }, { headers });
  } catch (error) {
    // Allowlist codes only; never return/log database details, bodies or tokens.
    const code =
      typeof error === "object" && error !== null && "code" in error
        ? error.code
        : undefined;
    if (code === "42501") return failure(403, "review_denied");
    if (code === "40001" || code === "22023" || code === "22P02")
      return failure(409, "review_evidence_blocked");
    return failure(503, "service_unavailable");
  }
}
