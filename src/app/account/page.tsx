import Link from "next/link";
import { cookies } from "next/headers";

import { WorkspaceShell } from "@/app/components/workspace-shell";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { authorizeCurrentSession } from "@/server/auth/current-session";
import { CSRF_TOKEN_COOKIE } from "@/server/security/session-csrf";

import { AccountSessionControls } from "./account-session-controls";
import { PersonalPasscodeChangeForm } from "./personal-passcode-change-form";
import { TemporaryPasscodeChangeForm } from "./temporary-passcode-change-form";

export const dynamic = "force-dynamic";

async function loadCurrentAccount() {
  try {
    const session = await authorizeCurrentSession(
      await createSupabaseServerClient(),
      { allowForcedPasscodeChange: true },
    );
    if (!session.allowed) return { kind: "denied" } as const;
    return session.account.mustChangePasscode
      ? ({ kind: "change_required" } as const)
      : ({ kind: "authorized", role: session.account.role } as const);
  } catch {
    return { kind: "unavailable" } as const;
  }
}

/** Private account safety page; it deliberately shows no identifier or alias. */
export default async function AccountPage() {
  const result = await loadCurrentAccount();
  if (result.kind === "denied") return <SignInRequired />;
  if (result.kind === "unavailable") return <AccountUnavailable />;
  if (result.kind === "change_required") {
    const csrfToken = (await cookies()).get(CSRF_TOKEN_COOKIE)?.value ?? null;
    return <PasscodeChangeRequired csrfToken={csrfToken} />;
  }

  return (
    <WorkspaceShell
      className="reports-page account-page"
      current="Account"
      title="Account"
    >
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
      <PersonalPasscodeChangeForm />
    </WorkspaceShell>
  );
}

function PasscodeChangeRequired({
  csrfToken,
}: Readonly<{ csrfToken: string | null }>) {
  return (
    <WorkspaceShell className="reports-page account-page" title="Account">
      <section
        className="reports-intro"
        aria-labelledby="passcode-change-title"
      >
        <p className="eyebrow">Private workspace</p>
        <h1 id="passcode-change-title">Change your temporary passcode</h1>
        <p>
          This is the only account action available until your temporary
          passcode is replaced.
        </p>
      </section>
      <TemporaryPasscodeChangeForm csrfToken={csrfToken} />
    </WorkspaceShell>
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
        <Link className="reports-home-link" href="/home">
          Return home
        </Link>
      </section>
    </main>
  );
}
