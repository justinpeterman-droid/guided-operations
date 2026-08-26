import Link from "next/link";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { authorizeCurrentSession } from "@/server/auth/current-session";

import { NewIncidentWorkspace } from "./new-incident-workspace";

export const dynamic = "force-dynamic";

export default async function NewIncidentPage() {
  const access = await loadIncidentAccess();
  if (access === "unavailable") return <Unavailable />;
  if (access === "denied") return <SignInRequired />;
  return <NewIncidentWorkspace />;
}

async function loadIncidentAccess(): Promise<
  "authorized" | "denied" | "unavailable"
> {
  try {
    const session = await authorizeCurrentSession(
      await createSupabaseServerClient(),
    );
    return session.allowed ? "authorized" : "denied";
  } catch {
    return "unavailable";
  }
}

function SignInRequired() {
  return (
    <main className="reports-page reports-message-page">
      <section
        className="reports-empty-state"
        aria-labelledby="incident-login-title"
      >
        <h1 id="incident-login-title">Sign in to start an incident.</h1>
        <p>
          New incidents are available only to an authorized private account.
        </p>
        <Link className="reports-home-link" href="/login">
          Sign in
        </Link>
      </section>
    </main>
  );
}

function Unavailable() {
  return (
    <main className="reports-page reports-message-page">
      <section
        className="reports-empty-state"
        aria-labelledby="incident-unavailable-title"
      >
        <h1 id="incident-unavailable-title">New incident is unavailable.</h1>
        <p>No incident has been created. Please try again later.</p>
        <Link className="reports-home-link" href="/reports">
          Return to reports
        </Link>
      </section>
    </main>
  );
}
