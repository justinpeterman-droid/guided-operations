import Link from "next/link";

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
    <main className="reports-page reports-message-page">
      <section
        className="reports-empty-state"
        aria-labelledby="policy-sign-in-title"
      >
        <p className="eyebrow">Private workspace</p>
        <h1 id="policy-sign-in-title">Sign in to use Policy Expert.</h1>
        <p>
          Policy questions and cited guidance are available only after the app
          verifies your current account and permissions.
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
        aria-labelledby="policy-unavailable-title"
      >
        <p className="eyebrow">Policy Expert unavailable</p>
        <h1 id="policy-unavailable-title">
          Cited guidance cannot be loaded right now.
        </h1>
        <p>
          Your question has not been submitted or retained. Please try again
          later.
        </p>
        <Link className="reports-home-link" href="/">
          Return home
        </Link>
      </section>
    </main>
  );
}
