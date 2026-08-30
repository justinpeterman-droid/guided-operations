import { createSupabaseServerClient } from "@/lib/supabase/server";
import { authorizeCurrentSession } from "@/server/auth/current-session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const NO_STORE_HEADERS = { "Cache-Control": "private, no-store" };

/**
 * Returns only browser-safe session state after a current account check. It
 * deliberately omits identifiers, aliases, facility scope, and token material.
 */
export async function GET(): Promise<Response> {
  try {
    const client = await createSupabaseServerClient();
    const session = await authorizeCurrentSession(client);
    if (!session.allowed) return authenticationRequired();

    return Response.json(
      {
        data: {
          role: session.account.role,
          mustChangePasscode: session.account.mustChangePasscode,
        },
      },
      { headers: NO_STORE_HEADERS },
    );
  } catch {
    return Response.json(
      { error: "service_unavailable" },
      { status: 503, headers: NO_STORE_HEADERS },
    );
  }
}

function authenticationRequired(): Response {
  return Response.json(
    { error: "authentication_required" },
    { status: 401, headers: NO_STORE_HEADERS },
  );
}
