import {
  OfficerSignInRequiredMessage,
  OfficerUnavailableMessage,
} from "@/app/components/workspace-message-presets";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { authorizeCurrentSession } from "@/server/auth/current-session";

import { NewIncidentWorkspace } from "./new-incident-workspace";

export const metadata = {
  title: "Start a report",
};

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
    <OfficerSignInRequiredMessage
      description="New incidents are available only to an authorized private account."
      title="Sign in to start an incident."
    />
  );
}

function Unavailable() {
  return (
    <OfficerUnavailableMessage
      actions={[{ href: "/reports", label: "Return to reports" }]}
      description="No incident has been created. Please try again later."
      eyebrow="New incident unavailable"
      title="New incident is unavailable."
    />
  );
}
