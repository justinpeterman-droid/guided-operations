import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";

import { GuidedMark } from "@/app/components/workspace-brand";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { authorizeCurrentSession } from "@/server/auth/current-session";

export const dynamic = "force-dynamic";

/** Public entry: signed-in officers go to /home; everyone else sees sign-in. */
export default async function PublicLandingPage() {
  const access = await loadLandingAccess();
  if (access === "authorized") redirect("/home");
  if (access === "passcode_change_required") redirect("/account");

  return (
    <main className="foundation-page">
      <header className="brand-bar">
        <GuidedMark />
        <div>
          <p className="eyebrow">One facility · one trusted workspace</p>
          <p className="brand-name">Guided Operations</p>
        </div>
        <span className="foundation-badge">Advisory only</span>
      </header>

      <section
        className="foundation-grid landing-hero"
        aria-labelledby="page-title"
      >
        <div className="product-intro">
          <p className="eyebrow">Policy grounded. Officer controlled.</p>
          <h1 id="page-title">
            Clear guidance for the work that has to be right.
          </h1>
          <p className="lede">
            Guided Operations brings reports, daily paperwork, forms, and cited
            policy guidance into one calm web workspace. The officer reviews
            every answer and every document before anything becomes official.
          </p>

          <Link className="mobile-sign-in-action" href="/login">
            Sign in to Guided Operations
          </Link>
        </div>

        <aside className="sign-in-card" aria-labelledby="sign-in-title">
          <p className="eyebrow">Secure access</p>
          <h2 id="sign-in-title">Sign in to your facility</h2>
          <p className="supporting-copy">
            Sign in with your employee number and personal passcode. Accounts
            are issued by the unit administrator.
          </p>

          <div className="go-ui landing-sign-in-action">
            <Button asChild size="lg" className="w-full">
              <Link href="/login">Go to sign in</Link>
            </Button>
          </div>

          <p className="connection-status" id="connection-status" role="status">
            This is a working tool, not the system of record. Reports and
            paperwork you finish here are still filed through the agency&rsquo;s
            own system.
          </p>
        </aside>
      </section>

      <section
        className="landing-secondary"
        aria-label="How Guided Operations works"
      >
        <section
          className="landing-workflow"
          aria-labelledby="landing-how-title"
        >
          <div className="landing-workflow-heading">
            <span className="eyebrow">One clear loop</span>
            <span id="landing-how-title">From first note to final review</span>
          </div>
          <ol>
            <li>
              <span>01</span>
              <strong>Capture</strong>
              <small>Start with what is known.</small>
            </li>
            <li>
              <span>02</span>
              <strong>Review</strong>
              <small>Keep gaps and sources visible.</small>
            </li>
            <li>
              <span>03</span>
              <strong>Confirm</strong>
              <small>Decide before anything is official.</small>
            </li>
          </ol>
        </section>

        <ul className="principle-list">
          <li>
            <strong>Your facts stay yours.</strong>
            <span>
              AI may organize or draft; it may never invent missing facts.
            </span>
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

        <div className="landing-preview-band">
          <p className="eyebrow">See it before you sign in</p>
          <p className="preview-intro">
            Explore the workspace with fictional training data. Nothing here is
            saved or submitted.
          </p>
          <div className="landing-preview-links">
            <Link className="preview-link" href="/preview/workspace">
              Officer workspace
            </Link>
            <Link className="preview-link" href="/preview/count-sheet">
              Count sheet
            </Link>
            <Link className="preview-link" href="/preview/report-assistant">
              Report workspace
            </Link>
          </div>
        </div>
      </section>

      <footer className="foundation-footer">
        <span>Guided Operations</span>
        <span>Policy grounded. Officer controlled.</span>
      </footer>
    </main>
  );
}

async function loadLandingAccess(): Promise<
  "authorized" | "passcode_change_required" | "signed_out"
> {
  try {
    const session = await authorizeCurrentSession(
      await createSupabaseServerClient(),
      { allowForcedPasscodeChange: true },
    );
    if (!session.allowed) return "signed_out";
    return session.account.mustChangePasscode
      ? "passcode_change_required"
      : "authorized";
  } catch {
    return "signed_out";
  }
}
