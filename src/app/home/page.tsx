import Link from "next/link";

import { OfficerCommandCenter } from "@/app/components/workspace-command-center";
import { WorkspaceShell } from "@/app/components/workspace-shell";
import {
  HOME_ACTION,
  SIGN_IN_ACTION,
  WorkspaceMessage,
} from "@/app/components/workspace-message";
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
    <WorkspaceMessage
      actions={[{ href: "/account", label: "Change temporary passcode" }]}
      description="Your sign-in was accepted. Choose a personal passcode before using the workspace."
      eyebrow="Account security"
      title="Change your temporary passcode to open your workspace."
    />
  );
}

function SignInRequired() {
  return (
    <WorkspaceMessage
      actions={[SIGN_IN_ACTION]}
      description="Your home screen is available only after the app confirms your account."
      eyebrow="Private workspace"
      title="Sign in to open your workspace."
    />
  );
}

function Unavailable() {
  return (
    <WorkspaceMessage
      actions={[HOME_ACTION]}
      description="Your work has not been changed. Please try again later."
      eyebrow="Workspace unavailable"
      title="Your workspace cannot load right now."
    />
  );
}
