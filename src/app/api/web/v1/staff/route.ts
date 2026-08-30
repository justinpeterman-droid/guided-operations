import { randomUUID } from "node:crypto";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { listStaffSelectionForCurrentSession } from "@/server/incidents/list-staff-selection";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const API_VERSION = "web-v1";
const NO_STORE_HEADERS = { "Cache-Control": "private, no-store" };

export async function GET(request: Request): Promise<Response> {
  const requestId = randomUUID();
  const limit = parseListLimit(request.url);
  if (!limit) return errorResponse(400, "invalid_request", requestId);

  try {
    const client = await createSupabaseServerClient();
    const result = await listStaffSelectionForCurrentSession(client, limit);
    if (result.kind === "listed") {
      return Response.json(
        {
          data: { staff: result.staff },
          meta: { request_id: requestId, api_version: API_VERSION },
        },
        { headers: NO_STORE_HEADERS },
      );
    }

    return errorResponse(
      result.kind === "denied" ? 401 : 503,
      result.kind === "denied"
        ? "authentication_required"
        : "service_unavailable",
      requestId,
    );
  } catch {
    return errorResponse(503, "service_unavailable", requestId);
  }
}

function errorResponse(
  status: number,
  code: string,
  requestId: string,
): Response {
  return Response.json(
    {
      error: { code, message: "Request could not be completed." },
      meta: { request_id: requestId, api_version: API_VERSION },
    },
    { status, headers: NO_STORE_HEADERS },
  );
}

function parseListLimit(url: string): number | null {
  const rawLimit = new URL(url).searchParams.get("limit");
  if (rawLimit === null) return 100;
  if (!/^[1-9][0-9]{0,2}$/.test(rawLimit)) return null;

  const limit = Number(rawLimit);
  return limit <= 100 ? limit : null;
}
