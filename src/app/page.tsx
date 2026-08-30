import Link from "next/link";
import { redirect } from "next/navigation";

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
      </header>

      <section className="foundation-grid" aria-labelledby="page-title">
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

          <ul className="principle-list">
            <li>
              <strong>Your facts stay yours.</strong>
              <span>
                AI may organize or draft; it may never invent missing facts.
              </span>
            </li>
            <li>
              <strong>Sources stay visible.</strong>
              <span>
                Policy answers must point back to the approved source.
              </span>
            </li>
            <li>
              <strong>Nothing files itself.</strong>
              <span>
                People remain responsible for review, correction, and
                submission.
              </span>
            </li>
          </ul>
        </div>

        <aside className="sign-in-card" aria-labelledby="sign-in-title">
          <p className="eyebrow">Secure access</p>
          <h2 id="sign-in-title">Sign in to your facility</h2>
          <p className="supporting-copy">
            Use your employee number and personal passcode. This private
            workspace does not offer public registration or password recovery.
          </p>

          <Link className="sign-in-action" href="/login">
            Sign in
          </Link>

          <p className="connection-status" role="status">
            Fictional training previews below use sample data only. They never
            create or change real work.
          </p>

          <Link className="preview-link" href="/preview/workspace">
            View the officer workspace layout
          </Link>
          <Link className="preview-link" href="/preview/report-assistant">
            View the fictional report workspace
          </Link>
          <Link className="preview-link" href="/preview/count-sheet">
            Try the fictional Count Sheet
          </Link>
        </aside>
      </section>

      <footer className="foundation-footer">
        <span>Private officer workspace</span>
        <span>Next.js · Vercel · Supabase</span>
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
