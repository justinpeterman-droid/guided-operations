import Link from "next/link";

import { OfficerCommandCenter } from "@/app/components/workspace-command-center";
import { WorkspaceShell } from "@/app/components/workspace-shell";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { authorizeCurrentSession } from "@/server/auth/current-session";
import { listReportsForCurrentSession } from "@/server/incidents/list-reports";

export const dynamic = "force-dynamic";

/** Real signed-in home. It never invents work or shows an unsafe admin entry. */
export default async function HomePage() {
  const access = await loadAccess();
  if (access.kind === "denied") return <SignInRequired />;
  if (access.kind === "passcode_change_required") {
    return <PasscodeChangeRequired />;
  }
  if (access.kind === "unavailable") return <Unavailable />;

  return (
    <WorkspaceShell
      className="workspace-preview-page"
      current="Home"
      title="Officer workspace"
    >
      <OfficerCommandCenter reports={access.reports} />
      {access.role === "administrator" ? (
        <section
          className="workspace-preview-admin"
          aria-labelledby="admin-title"
        >
          <div>
            <p className="eyebrow">Administrator access</p>
            <h2 id="admin-title">Same workspace. Extra responsibility.</h2>
            <p>
              Open the protected administrator area to prepare roster, account,
              and health controls as they are safely completed.
            </p>
          </div>
          <Link className="workspace-admin-link" href="/admin">
            Open administrator area <span aria-hidden="true">→</span>
          </Link>
        </section>
      ) : null}
    </WorkspaceShell>
  );
}

async function loadAccess() {
  try {
    const client = await createSupabaseServerClient();
    const [session, reports] = await Promise.all([
      authorizeCurrentSession(client),
      listReportsForCurrentSession(client, 2),
    ]);
    if (!session.allowed) {
      return session.reason === "passcode_change_required"
        ? ({ kind: "passcode_change_required" } as const)
        : ({ kind: "denied" } as const);
    }

    return {
      kind: "authorized" as const,
      role: session.account.role,
      reports: reports.kind === "listed" ? reports.reports : null,
    };
  } catch {
    return { kind: "unavailable" } as const;
  }
}

function PasscodeChangeRequired() {
  return (
    <main className="reports-page reports-message-page">
      <section
        className="reports-empty-state"
        aria-labelledby="home-passcode-change-title"
      >
        <p className="eyebrow">Account security</p>
        <h1 id="home-passcode-change-title">
          Change your temporary passcode to open your workspace.
        </h1>
        <p>
          Your sign-in was accepted. Choose a personal passcode before using the
          workspace.
        </p>
        <Link className="reports-home-link" href="/account">
          Change temporary passcode
        </Link>
      </section>
    </main>
  );
}

function SignInRequired() {
  return (
    <main className="reports-page reports-message-page">
      <section
        className="reports-empty-state"
        aria-labelledby="home-login-title"
      >
        <p className="eyebrow">Private workspace</p>
        <h1 id="home-login-title">Sign in to open your workspace.</h1>
        <p>
          Your home screen is available only after the app confirms your
          account.
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
        aria-labelledby="home-unavailable-title"
      >
        <p className="eyebrow">Workspace unavailable</p>
        <h1 id="home-unavailable-title">
          Your workspace cannot load right now.
        </h1>
        <p>Your work has not been changed. Please try again later.</p>
        <Link className="reports-home-link" href="/home">
          Return home
        </Link>
      </section>
    </main>
  );
}
