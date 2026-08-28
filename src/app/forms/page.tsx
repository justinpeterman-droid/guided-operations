import Link from "next/link";

import { WorkspaceNavigation } from "@/app/components/workspace-navigation";
import {
  chainOfCustodyGuidance,
  countSheetCapabilities,
  dailyPaperworkCapabilities,
  unavailableForms,
} from "@/features/forms-library/catalog";
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
        <h1 id="forms-title">Find the right paperwork.</h1>
        <p>
          Every item shows what you can do with it. Unapproved paperwork stays
          unavailable, and official physical forms stay physical.
        </p>
      </section>

      <section className="forms-library-group" aria-labelledby="ready-title">
        <div className="forms-library-section-heading">
          <div>
            <p className="eyebrow">Working tools</p>
            <h2 id="ready-title">Available now</h2>
          </div>
          <span className="forms-library-count">1 officer tool</span>
        </div>
        <div className="forms-library-list">
          <article>
            <div>
              <p className="eyebrow">Reviewed Count Sheet structure</p>
              <h3>North Central Unit Count Sheet</h3>
              <p>
                Work with your assigned shift, review the difference, and keep
                every saved correction in history.
              </p>
              <CapabilityList items={countSheetCapabilities} />
            </div>
            {access.shiftCode ? (
              <Link className="forms-library-action" href="/count-sheet">
                Open Count Sheet <span aria-hidden="true">→</span>
              </Link>
            ) : (
              <span className="forms-not-ready">Shift assignment needed</span>
            )}
          </article>
        </div>
      </section>

      <section className="forms-library-group" aria-labelledby="admin-title">
        <div className="forms-library-section-heading">
          <div>
            <p className="eyebrow">Restricted by role</p>
            <h2 id="admin-title">Administrator paperwork</h2>
          </div>
        </div>
        <div className="forms-library-list">
          <article>
            <div>
              <h3>Daily paperwork</h3>
              <p>
                Open the protected six-form workspace. Each form stays locked
                until its exact source package is reviewed and approved.
              </p>
              <CapabilityList items={dailyPaperworkCapabilities} />
            </div>
            {access.role === "administrator" ? (
              <Link
                className="forms-library-action"
                href="/admin/paperwork/daily"
              >
                Open Daily Paperwork <span aria-hidden="true">→</span>
              </Link>
            ) : (
              <span className="forms-not-ready">Administrator only</span>
            )}
          </article>
        </div>
      </section>

      <section className="forms-library-group" aria-labelledby="physical-title">
        <div className="forms-library-section-heading">
          <div>
            <p className="eyebrow">Official paper process</p>
            <h2 id="physical-title">Physical-only paperwork</h2>
          </div>
        </div>
        <div className="forms-library-list forms-library-physical-list">
          <article>
            <div>
              <h3>{chainOfCustodyGuidance.title}</h3>
              <p>{chainOfCustodyGuidance.description}</p>
              <CapabilityList items={chainOfCustodyGuidance.capabilities} />
            </div>
            <span className="forms-physical-only">Use official paper form</span>
          </article>
        </div>
        <aside className="forms-library-warning">
          This app does not create, save, print, or replace the official Chain
          of Custody form.
        </aside>
      </section>

      <section className="forms-library-group" aria-labelledby="waiting-title">
        <div className="forms-library-section-heading">
          <div>
            <p className="eyebrow">Not yet approved</p>
            <h2 id="waiting-title">Coming later</h2>
          </div>
        </div>
        <div className="forms-library-list">
          {unavailableForms.map((item) => (
            <article key={item.title}>
              <div>
                <h3>{item.title}</h3>
                <p>{item.description}</p>
              </div>
              <span className="forms-not-ready">Not available</span>
            </article>
          ))}
        </div>
        <p className="forms-library-footnote">
          Add-to-incident and packet-building actions will appear only after an
          eligible digital form and its rules have been approved and tested.
        </p>
      </section>
    </main>
  );
}

export async function loadFormsAccess() {
  try {
    const session = await authorizeCurrentSession(
      await createSupabaseServerClient(),
    );
    return session.allowed
      ? ({
          kind: "authorized",
          role: session.account.role,
          shiftCode: session.account.shiftCode,
        } as const)
      : ({ kind: "denied" } as const);
  } catch {
    return { kind: "unavailable" } as const;
  }
}

function CapabilityList({ items }: Readonly<{ items: readonly string[] }>) {
  return (
    <ul className="forms-capability-list" aria-label="Capabilities">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
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
