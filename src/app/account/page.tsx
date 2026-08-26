import Link from "next/link";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { authorizeCurrentSession } from "@/server/auth/current-session";

import { AccountSessionControls } from "./account-session-controls";

export const dynamic = "force-dynamic";

async function loadCurrentAccount() {
  try {
    const session = await authorizeCurrentSession(
      await createSupabaseServerClient(),
    );
    return session.allowed
      ? ({ kind: "authorized", role: session.account.role } as const)
      : ({ kind: "denied" } as const);
  } catch {
    return { kind: "unavailable" } as const;
  }
}

/** Private account safety page; it deliberately shows no identifier or alias. */
export default async function AccountPage() {
  const result = await loadCurrentAccount();
  if (result.kind === "denied") return <SignInRequired />;
  if (result.kind === "unavailable") return <AccountUnavailable />;

  return (
    <main className="reports-page account-page">
      <header className="workspace-header reports-header">
        <Link className="workspace-brand" href="/">
          <span className="brand-mark" aria-hidden="true">
            GO
          </span>
          <span>
            <span className="eyebrow">Guided Operations</span>
            <strong>Account</strong>
          </span>
        </Link>
        <Link className="reports-home-link" href="/reports">
          Reports
        </Link>
      </header>

      <section className="reports-intro" aria-labelledby="account-title">
        <p className="eyebrow">Private workspace</p>
        <h1 id="account-title">Account safety</h1>
        <p>
          Your current role is <strong>{result.role}</strong>. This page never
          displays your employee number, internal sign-in alias, or session
          tokens.
        </p>
      </section>

      <AccountSessionControls />
    </main>
  );
}

function SignInRequired() {
  return (
    <main className="reports-page reports-message-page">
      <section className="reports-empty-state" aria-labelledby="sign-in-title">
        <p className="eyebrow">Private workspace</p>
        <h1 id="sign-in-title">Sign in to manage account safety.</h1>
        <p>Account session controls are available only to a current account.</p>
        <Link className="reports-home-link" href="/login">
          Go to sign in
        </Link>
      </section>
    </main>
  );
}

function AccountUnavailable() {
  return (
    <main className="reports-page reports-message-page">
      <section
        className="reports-empty-state"
        aria-labelledby="account-unavailable-title"
      >
        <p className="eyebrow">Account unavailable</p>
        <h1 id="account-unavailable-title">
          Account safety cannot load right now.
        </h1>
        <p>Your sessions have not been changed. Please try again later.</p>
        <Link className="reports-home-link" href="/">
          Return home
        </Link>
      </section>
    </main>
  );
}
