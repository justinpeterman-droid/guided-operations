import Link from "next/link";

import { WorkspaceShell } from "@/app/components/workspace-shell";
import {
  HOME_ACTION,
  SIGN_IN_ACTION,
  WorkspaceMessage,
} from "@/app/components/workspace-message";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { listIncidentsForCurrentSession } from "@/server/incidents/list-incidents";
import { listReportsForCurrentSession } from "@/server/incidents/list-reports";

import { ReportsList } from "./reports-list";
import { SignOutButton } from "./sign-out-button";

export const metadata = {
  title: "Report history",
};

export const dynamic = "force-dynamic";

async function loadAuthorizedWork() {
  try {
    const client = await createSupabaseServerClient();
    const [incidents, reports] = await Promise.all([
      listIncidentsForCurrentSession(client, 50),
      listReportsForCurrentSession(client, 50),
    ]);
    if (incidents.kind === "denied" || reports.kind === "denied")
      return { kind: "denied" } as const;
    if (incidents.kind === "unavailable" || reports.kind === "unavailable")
      return { kind: "unavailable" } as const;
    return {
      kind: "listed" as const,
      incidents: incidents.incidents,
      reports: reports.reports,
    };
  } catch {
    return { kind: "unavailable" } as const;
  }
}

/** Authorized server-rendered incident/report index; no demo data is used. */
export default async function ReportsPage() {
  const result = await loadAuthorizedWork();

  if (result.kind === "denied") return <SignInRequired />;
  if (result.kind === "unavailable") return <ReportsUnavailable />;

  return (
    <WorkspaceShell
      actions={<SignOutButton />}
      current="Reports"
      title="Reports"
    >
      <section className="reports-intro">
        <p className="eyebrow">Your authorized work</p>
        <h1 id="reports-title">Reports and incidents</h1>
        <p>
          This workspace contains only records your current account is allowed
          to see. It never substitutes a training example for a missing record.
        </p>
      </section>

      {result.incidents.length === 0 && result.reports.length === 0 ? (
        <section className="reports-empty-state" aria-labelledby="empty-title">
          <h2 id="empty-title">No incidents are available.</h2>
          <p>
            There are no active incidents for this account yet. When an
            authorized incident is created, it will appear here with its current
            review status.
          </p>
          <Link className="reports-home-link" href="/incidents/new">
            Start a new incident
          </Link>
        </section>
      ) : (
        <ReportsList incidents={result.incidents} reports={result.reports} />
      )}
    </WorkspaceShell>
  );
}

function SignInRequired() {
  return (
    <WorkspaceMessage
      actions={[SIGN_IN_ACTION]}
      description="Reports are available only after the application verifies your current account and permissions."
      eyebrow="Private workspace"
      title="Sign in to view reports."
    />
  );
}

function ReportsUnavailable() {
  return (
    <WorkspaceMessage
      actions={[HOME_ACTION]}
      description="Your existing work has not been changed. Please try again after the service is available."
      eyebrow="Reports unavailable"
      title="Reports cannot be loaded right now."
    />
  );
}
