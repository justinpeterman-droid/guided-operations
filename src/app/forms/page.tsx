import Link from "next/link";

import { WorkspaceNavigation } from "@/app/components/workspace-navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { authorizeCurrentSession } from "@/server/auth/current-session";

export const dynamic = "force-dynamic";

/** Protected approved-form catalog. It never lists an unreviewed form as ready. */
export default async function FormsPage() {
  const access = await loadFormsAccess();
  if (access.kind === "denied") return <SignInRequired />;
  if (access.kind === "unavailable") return <Unavailable />;

  return (
    <main className="forms-library-page">
      <header className="workspace-header reports-header">
        <Link className="workspace-brand" href="/home">
          <span className="brand-mark" aria-hidden="true">
            GO
          </span>
          <span>
            <span className="eyebrow">Guided Operations</span>
            <strong>Forms Library</strong>
          </span>
        </Link>
        <WorkspaceNavigation current="Forms" />
      </header>

      <section className="forms-library-intro" aria-labelledby="forms-title">
        <p className="eyebrow">Approved paperwork</p>
        <h1 id="forms-title">Use the right form, with the right limits.</h1>
        <p>
          Only reviewed forms appear as available. Paperwork that has not passed
          source, records, and print review stays clearly unavailable.
        </p>
      </section>

      <section className="forms-library-group" aria-labelledby="ready-title">
        <h2 id="ready-title">Available now</h2>
        <div className="forms-library-list">
          <article>
            <div>
              <p className="eyebrow">Shift-shared · Saved revisions</p>
              <h3>North Central Unit Count Sheet</h3>
              <p>
                Enter the approved count structure, review the difference, save
                corrections as new revisions, and inspect preserved history.
              </p>
            </div>
            {access.shiftCode ? (
              <Link href="/count-sheet">
                Open Count Sheet <span aria-hidden="true">→</span>
              </Link>
            ) : (
              <span className="forms-not-ready">Shift assignment needed</span>
            )}
          </article>
        </div>
      </section>

      <section className="forms-library-group" aria-labelledby="review-title">
        <h2 id="review-title">Waiting for approved source forms</h2>
        <div className="forms-library-list">
          <article>
            <div>
              <h3>Daily paperwork</h3>
              <p>
                Each source form, current version, use, retention rule, and
                print layout must be reviewed before it can appear here.
              </p>
            </div>
            <span className="forms-not-ready">Not ready yet</span>
          </article>
          <article>
            <div>
              <h3>Monthly packets</h3>
              <p>
                Packet contents and official output rules are still being
                reconciled against the approved source.
              </p>
            </div>
            <span className="forms-not-ready">Not ready yet</span>
          </article>
        </div>
      </section>

      <aside className="forms-library-warning" aria-labelledby="paper-title">
        <p className="eyebrow">Paper-only work stays paper-only</p>
        <h2 id="paper-title">A physical process is not a website form.</h2>
        <p>
          Physical-only workflows remain physical-only unless an approved
          product and records decision changes that rule.
        </p>
      </aside>
    </main>
  );
}

export async function loadFormsAccess() {
  try {
    const session = await authorizeCurrentSession(
      await createSupabaseServerClient(),
    );
    return session.allowed
      ? ({ kind: "authorized", shiftCode: session.account.shiftCode } as const)
      : ({ kind: "denied" } as const);
  } catch {
    return { kind: "unavailable" } as const;
  }
}

function SignInRequired() {
  return (
    <MessagePage
      eyebrow="Private workspace"
      title="Sign in to open the Forms Library."
      copy="Approved forms are available only after the app verifies your current account."
      href="/login"
      action="Sign in"
    />
  );
}

function Unavailable() {
  return (
    <MessagePage
      eyebrow="Forms unavailable"
      title="The Forms Library cannot load right now."
      copy="No paperwork has been changed. Please try again later."
      href="/home"
      action="Return home"
    />
  );
}

function MessagePage({
  eyebrow,
  title,
  copy,
  href,
  action,
}: Readonly<{
  eyebrow: string;
  title: string;
  copy: string;
  href: string;
  action: string;
}>) {
  return (
    <main className="reports-page reports-message-page">
      <section
        className="reports-empty-state"
        aria-labelledby="forms-message-title"
      >
        <p className="eyebrow">{eyebrow}</p>
        <h1 id="forms-message-title">{title}</h1>
        <p>{copy}</p>
        <Link className="reports-home-link" href={href}>
          {action}
        </Link>
      </section>
    </main>
  );
}
