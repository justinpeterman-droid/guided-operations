import Link from "next/link";

import { WorkspaceShell } from "@/app/components/workspace-shell";
import { DocumentStudio } from "@/features/incidents/document-studio";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getIncidentReportWorkspaceForCurrentSession } from "@/server/incidents/get-incident-report-workspace";
import { listIncidentsForCurrentSession } from "@/server/incidents/list-incidents";
import { listReportsForCurrentSession } from "@/server/incidents/list-reports";

export const dynamic = "force-dynamic";

export default async function IncidentReportWorkspacePage({
  params,
}: {
  params: Promise<{ incidentId: string }>;
}) {
  const { incidentId } = await params;
  const result = await loadIncidentReportWorkspace(incidentId);

  if (result.kind === "denied") {
    return <Message title="Sign in to prepare a report." />;
  }
  if (result.kind === "not_found") {
    return <Message title="Incident unavailable." />;
  }
  if (result.kind === "unavailable") {
    return <Message title="Report preparation is unavailable right now." />;
  }

  const [incident, reports] = await Promise.all([
    loadIncidentSummary(incidentId),
    loadIncidentReports(result.workspace.incidentNumber),
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
    const listed = await listIncidentsForCurrentSession(
      await createSupabaseServerClient(),
      100,
    );
    if (listed.kind !== "listed") return null;
    return (
      listed.incidents.find((incident) => incident.incidentId === incidentId) ??
      null
    );
  } catch {
    return null;
  }
}

async function loadIncidentReports(incidentNumber: string) {
  try {
    const listed = await listReportsForCurrentSession(
      await createSupabaseServerClient(),
      100,
    );
    if (listed.kind !== "listed") return [];
    return listed.reports.filter(
      (report) => report.incidentNumber === incidentNumber,
    );
  } catch {
    return [];
  }
}

function Message({ title }: { title: string }) {
  return (
    <main className="reports-page reports-message-page">
      <section className="reports-empty-state">
        <p className="eyebrow">Private workspace</p>
        <h1>{title}</h1>
        <p>Your existing incident and reports have not been changed.</p>
        <Link className="reports-home-link" href="/reports">
          Return to reports
        </Link>
      </section>
    </main>
  );
}
