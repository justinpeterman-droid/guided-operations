import "server-only";

import {
  authorizeCurrentSession,
  type CurrentSessionClient,
} from "@/server/auth/current-session";

import { assertApplicationEnvironmentReadiness } from "./application-environment-readiness";
import { hasSupabaseReadiness } from "./supabase-readiness";

export type AdminSystemHealthResult =
  | Readonly<{
      kind: "ready";
      application: "ready";
      supabase: "ready" | "unavailable";
    }>
  | Readonly<{ kind: "denied" }>
  | Readonly<{ kind: "unavailable" }>;

/**
 * Performs only the same safe readiness checks used by the application health
 * endpoint, after the current administrator account has been verified.
 */
export async function getAdminSystemHealth(
  client: CurrentSessionClient,
  checkSupabase: typeof hasSupabaseReadiness = hasSupabaseReadiness,
): Promise<AdminSystemHealthResult> {
  const session = await authorizeCurrentSession(client, {
    requiredRole: "administrator",
  });
  if (!session.allowed) return { kind: "denied" };

  try {
    const { publicSupabase } = assertApplicationEnvironmentReadiness();
    const ready = await checkSupabase(
      publicSupabase.NEXT_PUBLIC_SUPABASE_URL,
      publicSupabase.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    );
    return {
      kind: "ready",
      application: "ready",
      supabase: ready ? "ready" : "unavailable",
    };
  } catch {
    return { kind: "unavailable" };
  }
}
