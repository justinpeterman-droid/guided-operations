import { WorkspaceShell } from "@/app/components/workspace-shell";
import {
  OfficerSignInRequiredMessage,
  OfficerUnavailableMessage,
} from "@/app/components/workspace-message-presets";
import { DocumentStudio } from "@/features/incidents/document-studio";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getIncidentReportWorkspaceForCurrentSession } from "@/server/incidents/get-incident-report-workspace";
import { getIncidentSummaryForCurrentSession } from "@/server/incidents/list-incidents";
import { listIncidentReportsForCurrentSession } from "@/server/incidents/list-reports";

export const dynamic = "force-dynamic";

export default async function IncidentReportWorkspacePage({
  params,
}: {
  params: Promise<{ incidentId: string }>;
}) {
  const { incidentId } = await params;
  const result = await loadIncidentReportWorkspace(incidentId);

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
    loadIncidentSummary(incidentId),
    loadIncidentReports(incidentId),
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

export async function loadIncidentReportWorkspace(incidentId: unknown) {
  try {
    return await getIncidentReportWorkspaceForCurrentSession(
      incidentId,
      await createSupabaseServerClient(),
    );
  } catch {
    return { kind: "unavailable" } as const;
  }
}

async function loadIncidentSummary(incidentId: string) {
  try {
    const result = await getIncidentSummaryForCurrentSession(
      incidentId,
      await createSupabaseServerClient(),
    );
    return result.kind === "found" ? result.incident : null;
  } catch {
    return null;
  }
}

async function loadIncidentReports(incidentId: string) {
  try {
    const listed = await listIncidentReportsForCurrentSession(
      incidentId,
      await createSupabaseServerClient(),
    );
    if (listed.kind !== "listed") return [];
    return listed.reports;
  } catch {
    return [];
  }
}
