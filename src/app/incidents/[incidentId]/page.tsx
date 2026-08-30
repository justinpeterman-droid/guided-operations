import Link from "next/link";

import { WorkspaceShell } from "@/app/components/workspace-shell";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getIncidentReportWorkspaceForCurrentSession } from "@/server/incidents/get-incident-report-workspace";

import { ReportDraftRequestForm } from "./report-draft-request-form";

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

  return (
    <WorkspaceShell current="Reports" title="Report Assistant">
      <section className="reports-intro" aria-labelledby="incident-title">
        <p className="eyebrow">Authorized incident · current revision</p>
        <h1 id="incident-title">{result.workspace.displayName}</h1>
        <p>
          <strong>{result.workspace.incidentNumber}</strong> ·{" "}
          {result.workspace.category} · revision{" "}
          {result.workspace.revisionNumber}
        </p>
        <p>
          Select one officer and only the confirmed facts that belong in that
          officer&apos;s perspective. The generated copy must still be reviewed
          and corrected before it becomes a report.
        </p>
      </section>

      <ReportDraftRequestForm workspace={result.workspace} />
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
