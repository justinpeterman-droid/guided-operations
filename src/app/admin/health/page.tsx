import { AdminAccountLink, AdminShell } from "@/app/components/admin-shell";
import {
  AdminAccessRequiredMessage,
  AdminUnavailableMessage,
} from "@/app/components/workspace-message-presets";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAdminSystemHealth } from "@/server/health/admin-system-health";

export const dynamic = "force-dynamic";

/** Protected, truthful status screen for the site and its Supabase connection. */
export default async function AdminHealthPage() {
  const result = await loadHealth();
  if (result.kind === "denied") return <AccessRequired />;
  if (result.kind === "unavailable") return <Unavailable />;

  return (
    <AdminShell actions={<AdminAccountLink />} title="System health">
      <section className="reports-intro" aria-labelledby="health-title">
        <p className="eyebrow">Administrator workspace</p>
        <h1 id="health-title">System health</h1>
        <p>
          These are live, limited readiness checks. They do not expose keys,
          database details, or private records.
        </p>
      </section>

      <section className="admin-action-list" aria-label="System status">
        <HealthItem title="Website" status={result.application} />
        <HealthItem title="Supabase connection" status={result.supabase} />
      </section>
    </AdminShell>
  );
}

function HealthItem({
  title,
  status,
}: Readonly<{ title: string; status: "ready" | "unavailable" }>) {
  const ready = status === "ready";
  return (
    <article>
      <span aria-hidden="true">{ready ? "✓" : "!"}</span>
      <div>
        <h2>{title}</h2>
        <p>{ready ? "Ready" : "Unavailable right now"}</p>
      </div>
      <em>{ready ? "Ready" : "Check needed"}</em>
    </article>
  );
}

async function loadHealth() {
  try {
    return await getAdminSystemHealth(await createSupabaseServerClient());
  } catch {
    return { kind: "unavailable" } as const;
  }
}

function AccessRequired() {
  return (
    <AdminAccessRequiredMessage description="This system view is available only to a current administrator." />
  );
}

function Unavailable() {
  return (
    <AdminUnavailableMessage
      description="The health check is unavailable; no service status can be confirmed right now."
      eyebrow="System health unavailable"
      title="The status check cannot load right now."
    />
  );
}
