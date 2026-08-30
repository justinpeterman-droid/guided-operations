import { randomUUID } from "node:crypto";

import { assertApplicationEnvironmentReadiness } from "@/server/health/application-environment-readiness";
import { hasSupabaseReadiness } from "@/server/health/supabase-readiness";
import {
  boundedOperationalDuration,
  observedResponse,
} from "@/server/observability/observed-response";
import type { SafeOperationalEventInput } from "@/server/observability/safe-operational-event";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const requestId = randomUUID();
  const startedAt = Date.now();
  let environment: SafeOperationalEventInput["environment"] | undefined;

  try {
    const { publicSupabase, runtime: runtimeEnvironment } =
      assertApplicationEnvironmentReadiness();
    environment = runtimeEnvironment.APP_ENV;
    const ready = await hasSupabaseReadiness(
      publicSupabase.NEXT_PUBLIC_SUPABASE_URL,
      publicSupabase.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    );

    if (!ready) {
      return observe(
        notReady(),
        "service_unavailable",
        requestId,
        startedAt,
        environment,
      );
    }

    return observe(
      Response.json(
        { service: "guided-operations-web", status: "ready" },
        { headers: { "Cache-Control": "no-store" } },
      ),
      "completed",
      requestId,
      startedAt,
      environment,
    );
  } catch {
    const response = notReady();
    return environment
      ? observe(
          response,
          "service_unavailable",
          requestId,
          startedAt,
          environment,
        )
      : response;
  }
}

function observe(
  response: Response,
  outcome: "completed" | "service_unavailable",
  requestId: string,
  startedAt: number,
  environment: SafeOperationalEventInput["environment"],
): Response {
  return observedResponse(response, {
    event_name: "health.readiness",
    outcome,
    request_id: requestId,
    status_code: response.status,
    duration_ms: boundedOperationalDuration(startedAt),
    environment,
  });
}

function notReady() {
  return Response.json(
    { service: "guided-operations-web", status: "not_ready" },
    { status: 503, headers: { "Cache-Control": "no-store" } },
  );
}
