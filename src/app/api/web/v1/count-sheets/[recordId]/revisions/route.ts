import { randomUUID } from "node:crypto";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  getCountSheetRevisionForCurrentSession,
  listCountSheetRevisionsForCurrentSession,
} from "@/server/paperwork/count-sheet-revision-history";

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
      const result = await getCountSheetRevisionForCurrentSession(
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
      return error(
        result.kind === "denied"
          ? 401
          : result.kind === "not_found"
            ? 404
            : 503,
        result.kind === "denied"
          ? "authentication_required"
          : result.kind === "not_found"
            ? "not_found"
            : "service_unavailable",
        requestId,
      );
    }

    const result = await listCountSheetRevisionsForCurrentSession(
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
    return error(
      result.kind === "denied" ? 401 : result.kind === "not_found" ? 404 : 503,
      result.kind === "denied"
        ? "authentication_required"
        : result.kind === "not_found"
          ? "not_found"
          : "service_unavailable",
      requestId,
    );
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
    { status, headers },
  );
}
