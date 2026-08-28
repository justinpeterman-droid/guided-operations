import { getAuthServerEnvironment } from "@/lib/env/auth-server";
import { getRuntimeEnvironment } from "@/lib/env/runtime";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { authorizeCurrentSession } from "@/server/auth/current-session";
import { runDailyPaperworkTemplatePackageCommand } from "@/server/paperwork/daily-paperwork-template-package-command";
import type { DailyPaperworkSourceFile } from "@/server/paperwork/daily-paperwork-source-package";
import { createDailyPaperworkTemplatePackageStore } from "@/server/paperwork/private-daily-paperwork-template-package-store";
import { isTrustedMutationRequest } from "@/server/security/request-origin";
import { hasValidSessionCsrfRequest } from "@/server/security/session-csrf";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const NO_STORE_HEADERS = { "Cache-Control": "private, no-store" };
const MAX_MULTIPART_BYTES = 2_000_000;
const MAX_SOURCE_BYTES = 1_536_000;

/**
 * Reviews or atomically registers the complete six-definition package. This
 * route intentionally does not exist outside the isolated Production runtime.
 */
export async function POST(request: Request): Promise<Response> {
  try {
    const [environment, runtimeEnvironment, client] = await Promise.all([
      getAuthServerEnvironment(),
      getRuntimeEnvironment(),
      createSupabaseServerClient(),
    ]);
    if (runtimeEnvironment.APP_ENV !== "production") return notFound();

    const session = await authorizeCurrentSession(client, {
      requiredRole: "administrator",
    });
    if (!session.allowed) return authenticationRequired();
    if (
      !isTrustedMutationRequest(request, runtimeEnvironment.APP_ORIGIN) ||
      !hasValidSessionCsrfRequest(
        request.headers,
        session.sessionId,
        environment.CSRF_HMAC_KEY,
      )
    )
      return requestNotAllowed();

    if (!hasAllowedMultipartHeaders(request.headers)) return invalidPackage();
    const form = await request.formData();
    const files = await readSourceFiles(form);
    if (!files) return invalidPackage();

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

    if (result.status === "invalid") return invalidPackage();
    if (result.status === "conflict") return conflict();
    if (result.status === "unavailable") return unavailable();
    if (result.status === "reviewed")
      return Response.json(
        { data: { evidence: result.evidence } },
        { headers: NO_STORE_HEADERS },
      );
    return Response.json(
      {
        data: {
          packageId: result.packageId,
          evidence: result.evidence,
        },
      },
      { status: 201, headers: NO_STORE_HEADERS },
    );
  } catch {
    return unavailable();
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

function notFound(): Response {
  return Response.json(
    { error: "not_found" },
    { status: 404, headers: NO_STORE_HEADERS },
  );
}

function authenticationRequired(): Response {
  return Response.json(
    { error: "authentication_required" },
    { status: 401, headers: NO_STORE_HEADERS },
  );
}

function requestNotAllowed(): Response {
  return Response.json(
    { error: "request_not_allowed" },
    { status: 403, headers: NO_STORE_HEADERS },
  );
}

function invalidPackage(): Response {
  return Response.json(
    { error: "invalid_template_package" },
    { status: 400, headers: NO_STORE_HEADERS },
  );
}

function conflict(): Response {
  return Response.json(
    { error: "template_package_changed" },
    { status: 409, headers: NO_STORE_HEADERS },
  );
}

function unavailable(): Response {
  return Response.json(
    { error: "service_unavailable" },
    { status: 503, headers: NO_STORE_HEADERS },
  );
}
