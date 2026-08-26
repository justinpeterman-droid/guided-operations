import Link from "next/link";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { authorizeCurrentSession } from "@/server/auth/current-session";

const officerTools = [
  {
    eyebrow: "Report assistant",
    title: "Start a clear report",
    copy: "Capture known facts, keep unknown details visible, and review the draft before it becomes a report.",
    href: "/incidents/new",
    action: "Start a report",
  },
  {
    eyebrow: "Your history",
    title: "Reports and incidents",
    copy: "Find only the reports and incidents your account is allowed to see.",
    href: "/reports",
    action: "View report history",
  },
  {
    eyebrow: "Policy assistant",
    title: "Ask a policy question",
    copy: "Policy answers must show their source. Missing evidence stays clearly marked.",
    href: "/policy-expert",
    action: "Open Policy Expert",
  },
  {
    eyebrow: "Shared shift paperwork",
    title: "Complete the Count Sheet",
    copy: "Open your assigned shift sheet, check the difference, and save each correction as a new revision.",
    href: "/count-sheet",
    action: "Open Count Sheet",
  },
  {
    eyebrow: "Forms library",
    title: "Find approved paperwork",
    copy: "See what forms are available, what is still being reviewed, and what must remain paper-only.",
    href: "/forms",
    action: "Open Forms Library",
  },
] as const;

export const dynamic = "force-dynamic";

/** Real signed-in home. It never invents work or shows an unsafe admin entry. */
export default async function HomePage() {
  const access = await loadAccess();
  if (access.kind === "denied") return <SignInRequired />;
  if (access.kind === "unavailable") return <Unavailable />;

  return (
    <main className="workspace-preview-page">
      <header className="workspace-preview-header">
        <Link className="workspace-brand" href="/home">
          <span className="brand-mark" aria-hidden="true">
            GO
          </span>
          <span>
            <span className="eyebrow">Guided Operations</span>
            <strong>Officer workspace</strong>
          </span>
        </Link>
        <Link className="reports-home-link" href="/account">
          Account
        </Link>
      </header>

      <section className="workspace-preview-hero" aria-labelledby="home-title">
        <div>
          <p className="eyebrow">Signed-in home</p>
          <h1 id="home-title">A calm place to begin the next right step.</h1>
          <p>
            Reports, forms, history, and policy guidance stay together. You
            remain in control of facts, corrections, and every final decision.
          </p>
        </div>
        <aside className="workspace-preview-safety" aria-label="Current access">
          <span aria-hidden="true">✓</span>
          <div>
            <strong>Private access confirmed</strong>
            <p>
              Your role is {access.role}. The site shows only the work your
              account is allowed to use.
            </p>
          </div>
        </aside>
      </section>

      <section aria-labelledby="tools-title">
        <div className="workspace-section-heading">
          <div>
            <p className="eyebrow">Your tools</p>
            <h2 id="tools-title">What would you like to work on?</h2>
          </div>
          <p>Designed for the workday, not a complicated software menu.</p>
        </div>
        <div className="workspace-tool-grid">
          {officerTools.map((tool, index) => (
            <article className="workspace-tool-card" key={tool.title}>
              <span className="workspace-tool-number" aria-hidden="true">
                0{index + 1}
              </span>
              <p className="eyebrow">{tool.eyebrow}</p>
              <h3>{tool.title}</h3>
              <p>{tool.copy}</p>
              <Link href={tool.href}>
                {tool.action} <span aria-hidden="true">→</span>
              </Link>
            </article>
          ))}
        </div>
      </section>
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
    </main>
  );
}

async function loadAccess() {
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
        <Link className="reports-home-link" href="/">
          Return home
        </Link>
      </section>
    </main>
  );
}
