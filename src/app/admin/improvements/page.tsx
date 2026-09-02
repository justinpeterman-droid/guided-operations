import Link from "next/link";

import {
  AdminAccessRequiredMessage,
  AdminUnavailableMessage,
} from "@/app/components/workspace-message-presets";
import { AdminAccountLink, AdminShell } from "@/app/components/admin-shell";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { authorizeCurrentSession } from "@/server/auth/current-session";

export const metadata = { title: "Suggestions and form review" };
export const dynamic = "force-dynamic";

type AdminRequest = Readonly<{
  request_id: string;
  request_kind: string;
  status: string;
  form_title: string | null;
  target_label: string | null;
  route_path: string | null;
  submitted_by_display_name: string;
  created_at: string;
  updated_at: string;
}>;

export default async function AdminImprovementsPage() {
  const loaded = await loadRequests();
  if (loaded.kind !== "authorized") {
    return loaded.kind === "denied" ? (
      <AdminAccessRequiredMessage description="Only current administrators can review facility suggestions and form candidates." />
    ) : (
      <AdminUnavailableMessage
        description="No request status was changed. Please try again later."
        eyebrow="Review queue unavailable"
        title="The suggestion queue cannot load right now."
      />
    );
  }
  return (
    <AdminShell
      actions={<AdminAccountLink />}
      className="improvement-page"
      title="Suggestions and form review"
    >
      <section className="improvement-page-intro">
        <p className="eyebrow">Administrator review queue</p>
        <h1>Review requests before anything changes.</h1>
        <p>
          Blank form candidates remain private. “Ready for publication” means
          ready for the separate protected template-registration process—not
          published to staff.
        </p>
      </section>
      <section
        className="improvement-request-list"
        aria-label="Facility review queue"
      >
        {loaded.requests.length ? (
          loaded.requests.map((request) => (
            <Link
              className="improvement-request-card"
              href={`/improvements/${request.request_id}`}
              key={request.request_id}
            >
              <span
                className={`improvement-status improvement-status-${request.status}`}
              >
                {request.status.replaceAll("_", " ")}
              </span>
              <div>
                <h2>
                  {request.form_title ??
                    request.target_label ??
                    (request.route_path
                      ? `Suggestion for ${request.route_path}`
                      : "Page suggestion")}
                </h2>
                <p>
                  {request.submitted_by_display_name} ·{" "}
                  {request.request_kind.replaceAll("_", " ")} · Updated{" "}
                  {new Intl.DateTimeFormat("en-US", {
                    month: "short",
                    day: "numeric",
                  }).format(new Date(request.updated_at))}
                </p>
              </div>
              <span aria-hidden="true">→</span>
            </Link>
          ))
        ) : (
          <div className="improvement-empty">
            <h2>No submissions are waiting.</h2>
            <p>
              New staff suggestions and blank form candidates will appear here.
            </p>
          </div>
        )}
      </section>
    </AdminShell>
  );
}

async function loadRequests(): Promise<
  | { kind: "authorized"; requests: AdminRequest[] }
  | { kind: "denied" | "unavailable" }
> {
  try {
    const client = await createSupabaseServerClient();
    const session = await authorizeCurrentSession(client, {
      requiredRole: "administrator",
    });
    if (!session.allowed) return { kind: "denied" };
    const result = await client.rpc("list_admin_improvement_requests", {
      p_limit: 100,
      p_status: undefined,
    });
    return result.error
      ? { kind: "unavailable" }
      : { kind: "authorized", requests: result.data ?? [] };
  } catch {
    return { kind: "unavailable" };
  }
}
