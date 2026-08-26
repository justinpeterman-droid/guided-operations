import Link from "next/link";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { listIncidentsForCurrentSession } from "@/server/incidents/list-incidents";

import { ReportsList } from "./reports-list";

export const dynamic = "force-dynamic";

async function loadAuthorizedIncidents() {
  try {
    const client = await createSupabaseServerClient();
    return await listIncidentsForCurrentSession(client, 50);
  } catch {
    return { kind: "unavailable" } as const;
  }
}

/** Authorized server-rendered incident/report index; no demo data is used. */
export default async function ReportsPage() {
  const result = await loadAuthorizedIncidents();

  if (result.kind === "denied") return <SignInRequired />;
  if (result.kind === "unavailable") return <ReportsUnavailable />;

  return (
    <main className="reports-page">
      <header className="workspace-header reports-header">
        <Link className="workspace-brand" href="/">
          <span className="brand-mark" aria-hidden="true">
            GO
          </span>
          <span>
            <span className="eyebrow">Guided Operations</span>
            <strong>Reports</strong>
          </span>
        </Link>
        <Link className="reports-home-link" href="/">
          Home
        </Link>
      </header>

      <section className="reports-intro" aria-labelledby="reports-title">
        <p className="eyebrow">Your authorized work</p>
        <h1 id="reports-title">Reports and incidents</h1>
        <p>
          This list contains only the incidents your current account is allowed
          to see. It never substitutes a training example for a missing record.
        </p>
      </section>

      {result.incidents.length === 0 ? (
        <section className="reports-empty-state" aria-labelledby="empty-title">
          <h2 id="empty-title">No incidents are available.</h2>
          <p>
            There are no active incidents for this account yet. When an
            authorized incident is created, it will appear here with its current
            review status.
          </p>
        </section>
      ) : (
        <ReportsList incidents={result.incidents} />
      )}
    </main>
  );
}

function SignInRequired() {
  return (
    <main className="reports-page reports-message-page">
      <section className="reports-empty-state" aria-labelledby="sign-in-title">
        <p className="eyebrow">Private workspace</p>
        <h1 id="sign-in-title">Sign in to view reports.</h1>
        <p>
          Reports are available only after the application verifies your current
          account and permissions.
        </p>
        <Link className="reports-home-link" href="/">
          Return home
        </Link>
      </section>
    </main>
  );
}

function ReportsUnavailable() {
  return (
    <main className="reports-page reports-message-page">
      <section
        className="reports-empty-state"
        aria-labelledby="unavailable-title"
      >
        <p className="eyebrow">Reports unavailable</p>
        <h1 id="unavailable-title">Reports cannot be loaded right now.</h1>
        <p>
          Your existing work has not been changed. Please try again after the
          service is available.
        </p>
        <Link className="reports-home-link" href="/">
          Return home
        </Link>
      </section>
    </main>
  );
}
