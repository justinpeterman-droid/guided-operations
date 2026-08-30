import { createHash, randomUUID } from "node:crypto";

import { getAuthServerEnvironment } from "@/lib/env/auth-server";
import { getIncidentServerEnvironment } from "@/lib/env/incident-server";
import { getRuntimeEnvironment } from "@/lib/env/runtime";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { authorizeCurrentSession } from "@/server/auth/current-session";
import {
  createReportRevisionDocx,
  REPORT_DOCX_MEDIA_TYPE,
  REPORT_DOCX_TEMPLATE_VERSION,
} from "@/server/exports/report-revision-docx";
import { getReportRevisionForExport } from "@/server/incidents/get-report-revision-for-export";
import { recordReportDocxExport } from "@/server/incidents/record-report-docx-export";
import { validateReportDocxExportRequest } from "@/server/incidents/report-docx-export-endpoint";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const privateHeaders = { "Cache-Control": "private, no-store" };

export async function POST(
  request: Request,
  context: { params: Promise<{ reportId: string }> },
): Promise<Response> {
  const requestId = randomUUID();
  try {
    const [{ reportId }, client] = await Promise.all([
      context.params,
      createSupabaseServerClient(),
    ]);
    const session = await authorizeCurrentSession(client);
    if (!session.allowed)
      return error(401, "authentication_required", requestId);
    const [auth, incident, runtimeEnvironment] = await Promise.all([
      getAuthServerEnvironment(),
      getIncidentServerEnvironment(),
      getRuntimeEnvironment(),
    ]);
    const validation = await validateReportDocxExportRequest(
      request,
      runtimeEnvironment.APP_ORIGIN,
      session.sessionId,
      auth.CSRF_HMAC_KEY,
    );
    if (!validation.ok)
      return error(validation.status, validation.code, requestId);

    const result = await getReportRevisionForExport(
      { reportId, revisionNumber: validation.revisionNumber },
      client,
    );
    if (result.kind !== "found")
      return error(
        result.kind === "denied"
          ? 403
          : result.kind === "not_found"
            ? 404
            : 503,
        result.kind === "denied"
          ? "request_not_allowed"
          : result.kind === "not_found"
            ? "report_revision_unavailable"
            : "service_unavailable",
        requestId,
      );

    const document = createReportRevisionDocx(result.revision);
    const sha256 = createHash("sha256").update(document).digest();
    const recorded = await recordReportDocxExport(
      {
        reportId,
        revisionNumber: validation.revisionNumber,
        outputSha256: sha256.toString("hex"),
        sizeBytes: document.byteLength,
        templateVersion: REPORT_DOCX_TEMPLATE_VERSION,
        idempotencyKey: validation.idempotencyKey,
        requestId,
      },
      client,
      incident.INCIDENT_IDEMPOTENCY_HMAC_KEY,
    );
    if (recorded.kind !== "recorded")
      return error(
        recorded.kind === "denied"
          ? 403
          : recorded.kind === "conflict"
            ? 409
            : 503,
        recorded.kind === "denied"
          ? "request_not_allowed"
          : recorded.kind === "conflict"
            ? "export_conflict"
            : "service_unavailable",
        requestId,
      );

    return new Response(Uint8Array.from(document), {
      status: 200,
      headers: {
        ...privateHeaders,
        "Content-Type": REPORT_DOCX_MEDIA_TYPE,
        "Content-Disposition": `attachment; filename="report-${reportId}-revision-${validation.revisionNumber}.docx"`,
        Digest: `sha-256=${sha256.toString("base64")}`,
        "X-Export-ID": recorded.exportId,
        "X-Report-Revision": String(validation.revisionNumber),
        "X-Template-Version": REPORT_DOCX_TEMPLATE_VERSION,
      },
    });
  } catch {
    return error(503, "service_unavailable", requestId);
  }
}

function error(status: number, code: string, requestId: string) {
  return Response.json(
    {
      error: { code, message: "Request could not be completed." },
      meta: { request_id: requestId, api_version: "web-v1" },
    },
    { status, headers: privateHeaders },
  );
}
