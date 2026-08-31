import { WorkspaceShell } from "@/app/components/workspace-shell";
import {
  OfficerSignInRequiredMessage,
  OfficerUnavailableMessage,
} from "@/app/components/workspace-message-presets";
import { DocumentStudio } from "@/features/incidents/document-studio";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getIncidentReportWorkspaceForCurrentSession } from "@/server/incidents/get-incident-report-workspace";
import { getIncidentSummaryForCurrentSession } from "@/server/incidents/get-incident-summary";
import { listReportsForIncidentForCurrentSession } from "@/server/incidents/list-incident-reports";

export const dynamic = "force-dynamic";

type IncidentPageClient = Parameters<
  typeof getIncidentReportWorkspaceForCurrentSession
>[1] &
  Parameters<typeof getIncidentSummaryForCurrentSession>[1] &
  Parameters<typeof listReportsForIncidentForCurrentSession>[1];

export default async function IncidentReportWorkspacePage({
  params,
}: {
  params: Promise<{ incidentId: string }>;
}) {
  const { incidentId } = await params;
  const client = await createSupabaseServerClient();
  const result = await loadIncidentReportWorkspace(incidentId, client);

  if (result.kind === "denied") {
    return (
      <OfficerSignInRequiredMessage
        description="Your existing incident and reports have not been changed."
        title="Sign in to prepare a report."
      />
    );
  }
  if (result.kind === "not_found") {
    return (
      <OfficerUnavailableMessage
        actions={[{ href: "/reports", label: "Return to reports" }]}
        description="Your existing incident and reports have not been changed."
        eyebrow="Private workspace"
        title="Incident unavailable."
      />
    );
  }
  if (result.kind === "unavailable") {
    return (
      <OfficerUnavailableMessage
        actions={[{ href: "/reports", label: "Return to reports" }]}
        description="Your existing incident and reports have not been changed."
        eyebrow="Private workspace"
        title="Report preparation is unavailable right now."
      />
    );
  }

  const [incident, reports] = await Promise.all([
    loadIncidentSummary(incidentId, client),
    loadIncidentReports(incidentId, client),
  ]);

  return (
    <WorkspaceShell current="Reports" title="Document Studio">
      <section className="reports-intro" aria-labelledby="incident-title">
        <p className="eyebrow">Authorized incident · current revision</p>
        <h1 id="incident-title">{result.workspace.displayName}</h1>
        <p>
          <strong>{result.workspace.incidentNumber}</strong> ·{" "}
          {result.workspace.category} · revision{" "}
          {result.workspace.revisionNumber}
        </p>
        <p>
          Use the tabs below to review packet state, request officer reports,
          inspect reviewed facts, and open report history without leaving this
          incident.
        </p>
      </section>

      <DocumentStudio
        incident={incident}
        reports={reports}
        workspace={result.workspace}
      />
    </WorkspaceShell>
  );
}

export async function loadIncidentReportWorkspace(
  incidentId: unknown,
  client: IncidentPageClient,
) {
  try {
    return await getIncidentReportWorkspaceForCurrentSession(incidentId, client);
  } catch {
    return { kind: "unavailable" } as const;
  }
}

export async function loadIncidentSummary(
  incidentId: string,
  client: IncidentPageClient,
) {
  try {
    const result = await getIncidentSummaryForCurrentSession(incidentId, client);
    return result.kind === "found" ? result.incident : null;
  } catch {
    return null;
  }
}

export async function loadIncidentReports(
  incidentId: string,
  client: IncidentPageClient,
) {
  try {
    const result = await listReportsForIncidentForCurrentSession(
      incidentId,
      client,
    );
    return result.kind === "listed" ? result.reports : [];
  } catch {
    return [];
  }
}
