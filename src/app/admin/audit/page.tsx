import { AdminAccountLink, AdminShell } from "@/app/components/admin-shell";
import {
  AdminAccessRequiredMessage,
  AdminUnavailableMessage,
} from "@/app/components/workspace-message-presets";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { listAdminAuditEventsForCurrentSession } from "@/server/auth/list-admin-audit-events";

export const metadata = {
  title: "Audit events",
};

export const dynamic = "force-dynamic";

/** Server-rendered redacted administrator audit timeline. */
export default async function AdminAuditPage() {
  const result = await loadAuditEvents();
  if (result.kind === "denied") return <AccessRequired />;
  if (result.kind === "unavailable") return <Unavailable />;

  return (
    <AdminShell actions={<AdminAccountLink />} title="Activity log">
      <section className="reports-intro" aria-labelledby="audit-title">
        <p className="eyebrow">Administrator workspace</p>
        <h1 id="audit-title">Activity log</h1>
        <p>
          This log shows safe, limited activity details. It never shows report
          text, passcodes, employee numbers, tokens, or policy content.
        </p>
      </section>

      {result.events.length === 0 ? (
        <section className="reports-empty-state" aria-labelledby="empty-title">
          <h2 id="empty-title">No safe activity entries are available.</h2>
          <p>New activity will appear here after it is recorded.</p>
        </section>
      ) : (
        <section
          className="reports-list-section"
          aria-labelledby="audit-list-title"
        >
          <h2 id="audit-list-title">Recent activity</h2>
          <div className="reports-list" role="list">
            {result.events.map((event) => (
              <article
                className="report-list-item"
                key={event.eventId}
                role="listitem"
              >
                <div>
                  <p className="eyebrow">
                    {formatOccurredAt(event.occurredAt)}
                  </p>
                  <h3>{formatEventType(event.eventType)}</h3>
                  <p>
                    {event.targetType
                      ? `Area: ${event.targetType}`
                      : "System activity"}
                    {event.outcome
                      ? ` · ${event.outcome.replaceAll("_", " ")}`
                      : ""}
                  </p>
                </div>
                <span className="report-status">Recorded</span>
              </article>
            ))}
          </div>
        </section>
      )}
    </AdminShell>
  );
}

function formatOccurredAt(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(value));
}

function formatEventType(value: string): string {
  return value
    .split(".")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

async function loadAuditEvents() {
  try {
    return await listAdminAuditEventsForCurrentSession(
      await createSupabaseServerClient(),
      50,
    );
  } catch {
    return { kind: "unavailable" } as const;
  }
}

function AccessRequired() {
  return (
    <AdminAccessRequiredMessage description="This activity log is available only to a current administrator." />
  );
}

function Unavailable() {
  return (
    <AdminUnavailableMessage
      description="No existing activity entries have been changed."
      eyebrow="Activity log unavailable"
      title="The activity log cannot load right now."
    />
  );
}
