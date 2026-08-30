import { randomUUID } from "node:crypto";
import { getAuthServerEnvironment } from "@/lib/env/auth-server";
import { getIncidentServerEnvironment } from "@/lib/env/incident-server";
import { getRuntimeEnvironment } from "@/lib/env/runtime";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { authorizeCurrentSession } from "@/server/auth/current-session";
import { appendReportRevisionForCurrentSession } from "@/server/incidents/append-report-revision";
import { validateReportRevisionRequest } from "@/server/incidents/report-revision-endpoint";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const h = { "Cache-Control": "private, no-store" };
export async function POST(
  r: Request,
  { params }: { params: Promise<{ reportId: string }> },
): Promise<Response> {
  const id = randomUUID();
  try {
    const [{ reportId }, a, i, e, c] = await Promise.all([
      params,
      getAuthServerEnvironment(),
      getIncidentServerEnvironment(),
      getRuntimeEnvironment(),
      createSupabaseServerClient(),
    ]);
    const s = await authorizeCurrentSession(c);
    if (!s.allowed) return err(401, "authentication_required", id);
    const v = await validateReportRevisionRequest(
      r,
      e.APP_ORIGIN,
      s.sessionId,
      a.CSRF_HMAC_KEY,
    );
    if (!v.ok) return err(v.status, v.code, id);
    const x = await appendReportRevisionForCurrentSession(
      {
        reportId,
        baseRevisionNumber: v.baseRevisionNumber,
        narrative: v.narrative,
        reason: v.reason,
        idempotencyKey: v.idempotencyKey,
      },
      c,
      i.INCIDENT_IDEMPOTENCY_HMAC_KEY,
    );
    return x.kind === "revised"
      ? Response.json(
          {
            data: { revisionNumber: x.revisionNumber },
            meta: { request_id: id, api_version: "web-v1" },
          },
          { status: 201, headers: h },
        )
      : err(
          x.kind === "denied" ? 403 : x.kind === "conflict" ? 409 : 503,
          x.kind === "denied"
            ? "request_not_allowed"
            : x.kind === "conflict"
              ? "revision_conflict"
              : "service_unavailable",
          id,
        );
  } catch {
    return err(503, "service_unavailable", id);
  }
}
function err(s: number, c: string, id: string) {
  return Response.json(
    {
      error: { code: c, message: "Request could not be completed." },
      meta: { request_id: id, api_version: "web-v1" },
    },
    { status: s, headers: h },
  );
}
