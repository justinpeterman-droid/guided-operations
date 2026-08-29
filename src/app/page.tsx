import { redirect } from "next/navigation";

import { logoutAction } from "@/app/actions/auth";
import { SignInForm } from "@/features/auth/sign-in-form";
import { getCurrentSession } from "@/server/auth/current-session";
import { isAuthServerConfigured } from "@/server/auth/server";

export const dynamic = "force-dynamic";

export default async function Home() {
  const authConfigured = isAuthServerConfigured();
  const session = authConfigured ? await getCurrentSession() : null;

  if (session?.account.mustChangePasscode) {
    redirect("/change-passcode");
  }

  if (session) {
    return <AuthenticatedHome session={session} />;
  }

  return (
    <main className="foundation-page">
      <BrandBar badge={authConfigured ? "Secure sign-in" : "Foundation preview"} />

      <section className="foundation-grid" aria-labelledby="page-title">
        <ProductIntro />

        <aside className="sign-in-card" aria-labelledby="sign-in-title">
          <p className="eyebrow">Secure access</p>
          <h2 id="sign-in-title">Sign in to your facility</h2>
          <p className="supporting-copy">
            Use your employee number and your individual personal passcode. No
            shared facility credential is used.
          </p>

          <SignInForm enabled={authConfigured} />

          <p className="connection-status" id="connection-status" role="status">
            {authConfigured
              ? "This environment is connected to the opaque employee-session boundary. Operational data remains fictional for this release."
              : "Secure authentication has not been connected in this environment. No live operational data or user accounts are available here."}
          </p>
        </aside>
      </section>

      <FoundationFooter />
    </main>
  );
}

function AuthenticatedHome({
  session,
}: {
  session: NonNullable<Awaited<ReturnType<typeof getCurrentSession>>>;
}) {
  return (
    <main className="foundation-page">
      <BrandBar badge="Authenticated preview" />

      <section className="dashboard-shell" aria-labelledby="dashboard-title">
        <div className="dashboard-hero">
          <p className="eyebrow">Protected workspace</p>
          <h1 id="dashboard-title">Welcome, {session.account.displayName}</h1>
          <p className="lede">
            Your individual session is active. Guided Operations will keep
            reports, paperwork, forms, and cited policy guidance behind this
            account boundary as each product milestone is accepted.
          </p>
        </div>

        <section className="dashboard-grid" aria-label="Guided Operations status">
          <article className="dashboard-card">
            <span className="dashboard-card-kicker">Identity</span>
            <h2>Individual account</h2>
            <p>
              Signed in as an {session.account.role}. Session authority is
              checked against the current account record on protected requests.
            </p>
          </article>
          <article className="dashboard-card">
            <span className="dashboard-card-kicker">Reports</span>
            <h2>Incident workspace</h2>
            <p>
              The report and Document Studio vertical slice is the next product
              milestone after this authentication gate.
            </p>
          </article>
          <article className="dashboard-card">
            <span className="dashboard-card-kicker">Policy</span>
            <h2>Grounded guidance</h2>
            <p>
              Policy Expert remains unavailable until the approved corpus is
              reconciled, hashed, page-mapped, and citation-tested.
            </p>
          </article>
        </section>

        <div className="dashboard-actions">
          <a className="secondary-action" href="/change-passcode">
            Change personal passcode
          </a>
          <form action={logoutAction}>
            <input type="hidden" name="csrfToken" value={session.csrfToken} />
            <button className="secondary-action" type="submit">
              Sign out
            </button>
          </form>
        </div>
      </section>

      <FoundationFooter />
    </main>
  );
}

function BrandBar({ badge }: { badge: string }) {
  return (
    <header className="brand-bar">
      <span className="brand-mark" aria-hidden="true">
        GO
      </span>
      <div>
        <p className="eyebrow">One facility · one trusted workspace</p>
        <p className="brand-name">Guided Operations</p>
      </div>
      <span className="foundation-badge">{badge}</span>
    </header>
  );
}

function ProductIntro() {
  return (
    <div className="product-intro">
      <p className="eyebrow">Policy grounded. Officer controlled.</p>
      <h1 id="page-title">Clear guidance for the work that has to be right.</h1>
      <p className="lede">
        Guided Operations brings reports, daily paperwork, forms, and cited
        policy guidance into one calm web workspace. The officer reviews every
        answer and every document before anything becomes official.
      </p>

      <ul className="principle-list">
        <li>
          <strong>Your facts stay yours.</strong>
          <span>AI may organize or draft; it may never invent missing facts.</span>
        </li>
        <li>
          <strong>Sources stay visible.</strong>
          <span>Policy answers must point back to the approved source.</span>
        </li>
        <li>
          <strong>Nothing files itself.</strong>
          <span>
            People remain responsible for review, correction, and submission.
          </span>
        </li>
      </ul>
    </div>
  );
}

function FoundationFooter() {
  return (
    <footer className="foundation-footer">
      <span>Private Guided Operations hobby release boundary</span>
      <span>Next.js · Vercel · Supabase PostgreSQL</span>
    </footer>
  );
}
