import { createHash, randomUUID } from "node:crypto";

import { z } from "zod";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { authorizeCurrentSession } from "@/server/auth/current-session";
import { createPrivateImprovementStore } from "@/server/feedback/private-improvement-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const API_VERSION = "web-v1";
const NO_STORE_HEADERS = { "Cache-Control": "private, no-store, max-age=0" };
const requestIdSchema = z.uuid();

/** Streams a verified blank form candidate to a same-facility administrator. */
export async function GET(
  _request: Request,
  context: Readonly<{
    params: Promise<Readonly<{ requestId: string }>>;
  }>,
): Promise<Response> {
  const correlationId = randomUUID();
  try {
    const [{ requestId }, client] = await Promise.all([
      context.params,
      createSupabaseServerClient(),
    ]);
    if (!requestIdSchema.safeParse(requestId).success) {
      return errorResponse(404, "not_found", correlationId);
    }

    const session = await authorizeCurrentSession(client, {
      requiredRole: "administrator",
    });
    if (!session.allowed) {
      return errorResponse(401, "authentication_required", correlationId);
    }

    const candidate =
      await createPrivateImprovementStore().getReviewableFormCandidate(
        requestId,
        session.account.facilityId,
      );
    if (!candidate) return errorResponse(404, "not_found", correlationId);

    const download = await client.storage
      .from(candidate.storageBucket)
      .download(candidate.storagePath);
    if (download.error || !download.data) {
      return errorResponse(503, "service_unavailable", correlationId);
    }

    const bytes = Buffer.from(await download.data.arrayBuffer());
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    if (
      bytes.byteLength !== candidate.actualByteSize ||
      sha256 !== candidate.actualSha256
    ) {
      return errorResponse(503, "service_unavailable", correlationId);
    }

    return new Response(bytes, {
      status: 200,
      headers: {
        ...NO_STORE_HEADERS,
        "Content-Disposition": `attachment; filename="${safeFilename(candidate.originalFilename)}"`,
        "Content-Length": String(bytes.byteLength),
        "Content-Security-Policy": "sandbox",
        "Content-Type": candidate.actualMediaType,
        "Cross-Origin-Resource-Policy": "same-origin",
        "Referrer-Policy": "no-referrer",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return errorResponse(503, "service_unavailable", correlationId);
  }
}

function safeFilename(filename: string): string {
  return filename.replaceAll(/["\\\r\n]/g, "_");
}

function errorResponse(
  status: 401 | 404 | 503,
  code: "authentication_required" | "not_found" | "service_unavailable",
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
