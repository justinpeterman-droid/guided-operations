import { randomUUID } from "node:crypto";

import { getAuthServerEnvironment } from "@/lib/env/auth-server";
import {
  getRuntimeEnvironment,
  type RuntimeEnvironment,
} from "@/lib/env/runtime";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { authorizeCurrentSession } from "@/server/auth/current-session";
import { runDailyPaperworkTemplatePackageCommand } from "@/server/paperwork/daily-paperwork-template-package-command";
import type { DailyPaperworkSourceFile } from "@/server/paperwork/daily-paperwork-source-package";
import { createDailyPaperworkTemplatePackageStore } from "@/server/paperwork/private-daily-paperwork-template-package-store";
import {
  writeSafeOperationalEvent,
  type SafeOperationalEventInput,
} from "@/server/observability/safe-operational-event";
import { isTrustedMutationRequest } from "@/server/security/request-origin";
import { hasValidSessionCsrfRequest } from "@/server/security/session-csrf";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const API_VERSION = "web-v1";
const MAX_MULTIPART_BYTES = 2_000_000;
const MAX_SOURCE_BYTES = 1_536_000;

/**
 * Reviews or atomically registers the complete six-definition package. This
 * route intentionally does not exist outside the isolated Production runtime.
 */
export async function POST(request: Request): Promise<Response> {
  const requestId = randomUUID();
  const startedAt = Date.now();
  let appEnvironment: RuntimeEnvironment["APP_ENV"] | undefined;

  try {
    const [environment, runtimeEnvironment, client] = await Promise.all([
      getAuthServerEnvironment(),
      getRuntimeEnvironment(),
      createSupabaseServerClient(),
    ]);
    appEnvironment = runtimeEnvironment.APP_ENV;
    if (runtimeEnvironment.APP_ENV !== "production")
      return observedResponse(notFound(requestId), {
        event_name: "daily_paperwork_package.request",
        outcome: "not_found",
        request_id: requestId,
        status_code: 404,
        duration_ms: boundedDuration(startedAt),
        environment: appEnvironment,
      });

    const session = await authorizeCurrentSession(client, {
      requiredRole: "administrator",
    });
    if (!session.allowed)
      return observedResponse(authenticationRequired(requestId), {
        event_name: "daily_paperwork_package.request",
        outcome: "authentication_required",
        request_id: requestId,
        status_code: 401,
        duration_ms: boundedDuration(startedAt),
        environment: appEnvironment,
      });
    if (
      !isTrustedMutationRequest(request, runtimeEnvironment.APP_ORIGIN) ||
      !hasValidSessionCsrfRequest(
        request.headers,
        session.sessionId,
        environment.CSRF_HMAC_KEY,
      )
    )
      return observedResponse(requestNotAllowed(requestId), {
        event_name: "daily_paperwork_package.request",
        outcome: "request_not_allowed",
        request_id: requestId,
        status_code: 403,
        duration_ms: boundedDuration(startedAt),
        environment: appEnvironment,
      });

    if (!hasAllowedMultipartHeaders(request.headers))
      return observedResponse(invalidPackage(requestId), {
        event_name: "daily_paperwork_package.request",
        outcome: "validation_rejected",
        request_id: requestId,
        status_code: 400,
        duration_ms: boundedDuration(startedAt),
        environment: appEnvironment,
      });
    const form = await request.formData();
    const files = await readSourceFiles(form);
    if (!files)
      return observedResponse(invalidPackage(requestId), {
        event_name: "daily_paperwork_package.request",
        outcome: "validation_rejected",
        request_id: requestId,
        status_code: 400,
        duration_ms: boundedDuration(startedAt),
        environment: appEnvironment,
      });

    const result = await runDailyPaperworkTemplatePackageCommand(
      {
        action: value(form, "action") as "validate" | "register",
        sourceAuthority: value(form, "sourceAuthority"),
        sourceRevision: value(form, "sourceRevision"),
        activeFrom: value(form, "activeFrom"),
        expectedCurrentPackageDigest: nullableValue(
          form,
          "expectedCurrentPackageDigest",
        ),
        rollbackOfPackageDigest: nullableValue(form, "rollbackOfPackageDigest"),
        files,
        proof: {
          token: value(form, "token"),
          requestId: value(form, "requestId"),
        },
        idempotencyKey: request.headers.get("idempotency-key") ?? undefined,
      },
      session,
      {
        store: createDailyPaperworkTemplatePackageStore(),
        hmacKey: environment.CSRF_HMAC_KEY,
      },
    );

    if (result.status === "invalid")
      return observedResponse(invalidPackage(requestId), {
        event_name: "daily_paperwork_package.request",
        outcome: "validation_rejected",
        request_id: requestId,
        status_code: 400,
        duration_ms: boundedDuration(startedAt),
        environment: appEnvironment,
      });
    if (result.status === "conflict")
      return observedResponse(conflict(requestId), {
        event_name: "daily_paperwork_package.request",
        outcome: "conflict",
        request_id: requestId,
        status_code: 409,
        duration_ms: boundedDuration(startedAt),
        environment: appEnvironment,
      });
    if (result.status === "unavailable")
      return observedResponse(unavailable(requestId), {
        event_name: "daily_paperwork_package.request",
        outcome: "service_unavailable",
        request_id: requestId,
        status_code: 503,
        duration_ms: boundedDuration(startedAt),
        environment: appEnvironment,
      });
    if (result.status === "reviewed")
      return observedResponse(
        Response.json(
          {
            data: { evidence: result.evidence },
            meta: { request_id: requestId, api_version: API_VERSION },
          },
          { headers: responseHeaders(requestId) },
        ),
        {
          event_name: "daily_paperwork_package.request",
          outcome: "reviewed",
          request_id: requestId,
          status_code: 200,
          duration_ms: boundedDuration(startedAt),
          environment: appEnvironment,
        },
      );
    return observedResponse(
      Response.json(
        {
          data: {
            packageId: result.packageId,
            evidence: result.evidence,
          },
          meta: { request_id: requestId, api_version: API_VERSION },
        },
        { status: 201, headers: responseHeaders(requestId) },
      ),
      {
        event_name: "daily_paperwork_package.request",
        outcome: "stored",
        request_id: requestId,
        status_code: 201,
        duration_ms: boundedDuration(startedAt),
        environment: appEnvironment,
      },
    );
  } catch {
    const response = unavailable(requestId);
    return appEnvironment
      ? observedResponse(response, {
          event_name: "daily_paperwork_package.request",
          outcome: "service_unavailable",
          reason_code: "unhandled_failure",
          request_id: requestId,
          status_code: 503,
          duration_ms: boundedDuration(startedAt),
          environment: appEnvironment,
        })
      : response;
  }
}

function hasAllowedMultipartHeaders(headers: Headers): boolean {
  const contentType = headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.startsWith("multipart/form-data;")) return false;
  const contentLength = headers.get("content-length");
  if (!contentLength) return false;
  if (!/^[1-9][0-9]{0,7}$/u.test(contentLength)) return false;
  return Number(contentLength) <= MAX_MULTIPART_BYTES;
}

async function readSourceFiles(
  form: FormData,
): Promise<readonly DailyPaperworkSourceFile[] | null> {
  const values = form.getAll("files");
  if (values.length !== 6 || values.some((entry) => typeof entry === "string"))
    return null;
  const files = values as File[];
  if (files.some((file) => file.type !== "application/json")) return null;
  let totalBytes = 0;
  const sources: DailyPaperworkSourceFile[] = [];
  for (const file of files) {
    totalBytes += file.size;
    if (totalBytes > MAX_SOURCE_BYTES) return null;
    sources.push({
      filename: file.name,
      bytes: new Uint8Array(await file.arrayBuffer()),
    });
  }
  return sources;
}

function value(form: FormData, name: string): string {
  const item = form.get(name);
  return typeof item === "string" ? item : "";
}

function nullableValue(form: FormData, name: string): string | null {
  return value(form, name).trim() || null;
}

function boundedDuration(startedAt: number): number {
  return Math.min(3_600_000, Math.max(0, Date.now() - startedAt));
}

function observedResponse(
  response: Response,
  event: SafeOperationalEventInput,
): Response {
  writeSafeOperationalEvent(event);
  return response;
}

function responseHeaders(requestId: string): HeadersInit {
  return {
    "Cache-Control": "private, no-store",
    "X-Request-Id": requestId,
  };
}

function errorResponse(
  status: number,
  code: string,
  requestId: string,
): Response {
  return Response.json(
    {
      error: code,
      meta: { request_id: requestId, api_version: API_VERSION },
    },
    { status, headers: responseHeaders(requestId) },
  );
}

function notFound(requestId: string): Response {
  return errorResponse(404, "not_found", requestId);
}

function authenticationRequired(requestId: string): Response {
  return errorResponse(401, "authentication_required", requestId);
}

function requestNotAllowed(requestId: string): Response {
  return errorResponse(403, "request_not_allowed", requestId);
}

function invalidPackage(requestId: string): Response {
  return errorResponse(400, "invalid_template_package", requestId);
}

function conflict(requestId: string): Response {
  return errorResponse(409, "template_package_changed", requestId);
}

function unavailable(requestId: string): Response {
  return errorResponse(503, "service_unavailable", requestId);
}
