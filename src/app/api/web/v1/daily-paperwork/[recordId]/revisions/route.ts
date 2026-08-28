import { randomUUID } from "node:crypto";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  getDailyPaperworkRevisionForCurrentSession,
  listDailyPaperworkRevisionsForCurrentSession,
} from "@/server/paperwork/daily-paperwork-revision-history";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const headers = { "Cache-Control": "private, no-store" };

export async function GET(
  request: Request,
  context: { params: Promise<{ recordId: string }> },
): Promise<Response> {
  const requestId = randomUUID();
  try {
    const [{ recordId }, client] = await Promise.all([
      context.params,
      createSupabaseServerClient(),
    ]);
    const revisionNumber = new URL(request.url).searchParams.get(
      "revision_number",
    );
    if (revisionNumber !== null) {
      const result = await getDailyPaperworkRevisionForCurrentSession(
        recordId,
        revisionNumber,
        client,
      );
      if (result.kind === "found")
        return Response.json(
          {
            data: result.revision,
            meta: { request_id: requestId, api_version: "web-v1" },
          },
          { status: 200, headers },
        );
      return errorFor(result.kind, requestId);
    }
    const result = await listDailyPaperworkRevisionsForCurrentSession(
      recordId,
      client,
    );
    if (result.kind === "listed")
      return Response.json(
        {
          data: { revisions: result.revisions },
          meta: { request_id: requestId, api_version: "web-v1" },
        },
        { status: 200, headers },
      );
    return errorFor(result.kind, requestId);
  } catch {
    return error(503, "service_unavailable", requestId);
  }
}

function errorFor(
  kind: "denied" | "not_found" | "unavailable",
  requestId: string,
) {
  return error(
    kind === "denied" ? 401 : kind === "not_found" ? 404 : 503,
    kind === "denied"
      ? "authentication_required"
      : kind === "not_found"
        ? "not_found"
        : "service_unavailable",
    requestId,
  );
}

function error(status: number, code: string, requestId: string) {
  return Response.json(
    {
      error: { code, message: "Request could not be completed." },
      meta: { request_id: requestId, api_version: "web-v1" },
    },
    { status, headers },
  );
}
