import {
  OfficerSignInRequiredMessage,
  OfficerUnavailableMessage,
} from "@/app/components/workspace-message-presets";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { authorizeCurrentSession } from "@/server/auth/current-session";

import { PolicyExpert } from "./policy-expert";

export const dynamic = "force-dynamic";

export default async function PolicyExpertPage() {
  const access = await loadPolicyExpertAccess();

  if (access === "unavailable") return <Unavailable />;
  if (access === "denied") return <SignInRequired />;

  return <PolicyExpert />;
}

async function loadPolicyExpertAccess(): Promise<
  "authorized" | "denied" | "unavailable"
> {
  try {
    const client = await createSupabaseServerClient();
    const session = await authorizeCurrentSession(client);
    return session.allowed ? "authorized" : "denied";
  } catch {
    return "unavailable";
  }
}

function SignInRequired() {
  return (
    <OfficerSignInRequiredMessage
      description="Policy questions and cited guidance are available only after the app verifies your current account and permissions."
      title="Sign in to use Policy Expert."
    />
  );
}

function Unavailable() {
  return (
    <OfficerUnavailableMessage
      description="Your question has not been submitted or retained. Please try again later."
      eyebrow="Policy Expert unavailable"
      title="Cited guidance cannot be loaded right now."
    />
  );
}
