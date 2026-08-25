import { getPublicSupabaseEnvironment } from "@/lib/env/supabase-public";
import { getRuntimeEnvironment } from "@/lib/env/runtime";
import { hasSupabaseReadiness } from "@/server/health/supabase-readiness";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    getRuntimeEnvironment();
    const supabase = getPublicSupabaseEnvironment();
    const ready = await hasSupabaseReadiness(
      supabase.NEXT_PUBLIC_SUPABASE_URL,
      supabase.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
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
