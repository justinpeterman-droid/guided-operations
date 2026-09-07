import {
  OfficerSignInRequiredMessage,
  OfficerUnavailableMessage,
} from "@/app/components/workspace-message-presets";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { IncidentDraft } from "@/features/incidents/incident-draft";
import { authorizeCurrentSession } from "@/server/auth/current-session";
import { getIncidentDraftForCurrentSession } from "@/server/incidents/incident-drafts";

import { NewIncidentWorkspace } from "./new-incident-workspace";

export const metadata = {
  title: "Start a report",
};

export const dynamic = "force-dynamic";

export default async function NewIncidentPage({
  searchParams,
}: Readonly<{ searchParams: Promise<{ draft?: string }> }>) {
  const { draft: draftId } = await searchParams;
  const access = await loadIncidentAccess(draftId);
  if (access.kind === "not_found")
    return (
      <OfficerUnavailableMessage
        actions={[
          { href: "/incidents/new", label: "Start a new incident" },
          { href: "/home", label: "Return Home" },
        ]}
        description="This saved draft is no longer available to your account. No new incident has been created."
        eyebrow="Draft unavailable"
        title="This draft cannot be reopened."
      />
    );
  if (access.kind === "unavailable") return <Unavailable />;
  if (access.kind === "denied") return <SignInRequired />;
  return <NewIncidentWorkspace initialDraft={access.draft} />;
}

async function loadIncidentAccess(
  draftId?: string,
): Promise<
  | { kind: "authorized"; draft: IncidentDraft | null }
  | { kind: "denied" }
  | { kind: "unavailable" }
  | { kind: "not_found" }
> {
  try {
    const client = await createSupabaseServerClient();
    const session = await authorizeCurrentSession(client);
    if (!session.allowed) return { kind: "denied" };
    if (!draftId) return { kind: "authorized", draft: null };
    const draft = await getIncidentDraftForCurrentSession(draftId, client);
    if (draft.kind === "not_found") return { kind: "not_found" };
    return draft.kind === "found"
      ? { kind: "authorized", draft: draft.draft }
      : { kind: draft.kind === "denied" ? "denied" : "unavailable" };
  } catch {
    return { kind: "unavailable" };
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
