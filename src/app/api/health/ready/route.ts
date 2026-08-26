import { assertApplicationEnvironmentReadiness } from "@/server/health/application-environment-readiness";
import { hasSupabaseReadiness } from "@/server/health/supabase-readiness";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const { publicSupabase } = assertApplicationEnvironmentReadiness();
    const ready = await hasSupabaseReadiness(
      publicSupabase.NEXT_PUBLIC_SUPABASE_URL,
      publicSupabase.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    );

    if (!ready) return notReady();

    return Response.json(
      { service: "guided-operations-web", status: "ready" },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return notReady();
  }
}

function notReady() {
  return Response.json(
    { service: "guided-operations-web", status: "not_ready" },
    { status: 503, headers: { "Cache-Control": "no-store" } },
  );
}
