import Link from "next/link";

import { FormCandidateRequestForm } from "@/app/components/form-candidate-request-form";
import { WorkspaceShell } from "@/app/components/workspace-shell";
import {
  OfficerSignInRequiredMessage,
  OfficerUnavailableMessage,
} from "@/app/components/workspace-message-presets";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { authorizeCurrentSession } from "@/server/auth/current-session";

export const metadata = { title: "Request or upload a form" };
export const dynamic = "force-dynamic";

export default async function NewImprovementRequestPage() {
  const access = await loadAccess();
  if (access === "denied") {
    return (
      <OfficerSignInRequiredMessage
        description="Sign in with your current account to submit a form request."
        title="Sign in to request a form."
      />
    );
  }
  if (access === "unavailable") {
    return (
      <OfficerUnavailableMessage
        description="Nothing was submitted. Please try again later."
        eyebrow="Request unavailable"
        title="This request page cannot load right now."
      />
    );
  }
  return (
    <WorkspaceShell
      current="Forms"
      title="Request or upload a form"
      className="improvement-page"
    >
      <section className="improvement-page-intro">
        <p className="eyebrow">Forms Library intake</p>
        <h1>Request a form, or send a blank candidate.</h1>
        <p>
          We will track the review here. A request does not make a form official
          or available in the library.
        </p>
        <Link href="/forms">Back to Forms Library</Link>
      </section>
      <section className="improvement-intake-card" aria-label="Form request">
        <FormCandidateRequestForm />
      </section>
    </WorkspaceShell>
  );
}

async function loadAccess(): Promise<"authorized" | "denied" | "unavailable"> {
  try {
    const session = await authorizeCurrentSession(
      await createSupabaseServerClient(),
    );
    return session.allowed ? "authorized" : "denied";
  } catch {
    return "unavailable";
  }
}
