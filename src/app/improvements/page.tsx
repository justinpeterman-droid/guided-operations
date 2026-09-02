import Link from "next/link";

import { WorkspaceShell } from "@/app/components/workspace-shell";
import {
  OfficerSignInRequiredMessage,
  OfficerUnavailableMessage,
} from "@/app/components/workspace-message-presets";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { authorizeCurrentSession } from "@/server/auth/current-session";

export const metadata = { title: "My suggestions and requests" };
export const dynamic = "force-dynamic";

type RequestRow = Readonly<{
  request_id: string;
  request_kind: string;
  status: string;
  form_title: string | null;
  target_label: string | null;
  route_path: string | null;
  created_at: string;
  updated_at: string;
}>;

export default async function ImprovementsPage() {
  const loaded = await loadRequests();
  if (loaded.kind !== "authorized") {
    return loaded.kind === "denied" ? (
      <OfficerSignInRequiredMessage
        description="Sign in with your current account to see your own suggestions and requests."
        title="Sign in to see your requests."
      />
    ) : (
      <OfficerUnavailableMessage
        description="No request information was changed. Please try again later."
        eyebrow="Requests unavailable"
        title="Your requests cannot load right now."
      />
    );
  }
  const requests = loaded.requests;
  return (
    <WorkspaceShell
      current="Forms"
      title="My suggestions and requests"
      className="improvement-page"
    >
      <section className="improvement-page-intro">
        <p className="eyebrow">Your follow-ups</p>
        <h1>Suggestions and form requests.</h1>
        <p>
          Use the detail page to see a review update. Nothing is published
          automatically.
        </p>
        <Link href="/improvements/new?kind=form">Request or upload a form</Link>
      </section>
      <section className="improvement-request-list" aria-label="Your requests">
        {requests.length ? (
          requests.map((request) => (
            <Link
              className="improvement-request-card"
              href={`/improvements/${request.request_id}`}
              key={request.request_id}
            >
              <span
                className={`improvement-status improvement-status-${request.status}`}
              >
                {displayStatus(request.status)}
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
                  {request.request_kind === "form_candidate"
                    ? "Blank form candidate"
                    : request.request_kind === "form_request"
                      ? "Form request"
                      : "Page feedback"}{" "}
                  · Updated {displayDate(request.updated_at)}
                </p>
              </div>
              <span aria-hidden="true">→</span>
            </Link>
          ))
        ) : (
          <div className="improvement-empty">
            <h2>Nothing submitted yet.</h2>
            <p>
              Use “Suggest a change” on any signed-in page, or request a form
              from the Forms Library.
            </p>
          </div>
        )}
      </section>
    </WorkspaceShell>
  );
}

async function loadRequests(): Promise<
  | { kind: "authorized"; requests: RequestRow[] }
  | { kind: "denied" | "unavailable" }
> {
  try {
    const client = await createSupabaseServerClient();
    const session = await authorizeCurrentSession(client);
    if (!session.allowed) return { kind: "denied" };
    const result = await client.rpc("list_my_improvement_requests", {
      p_limit: 100,
    });
    if (result.error) return { kind: "unavailable" };
    return { kind: "authorized", requests: result.data ?? [] };
  } catch {
    return { kind: "unavailable" };
  }
}

function displayStatus(status: string) {
  return status.replaceAll("_", " ");
}
function displayDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}
