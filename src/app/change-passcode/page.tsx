import { redirect } from "next/navigation";

import { ChangePasscodeForm } from "@/features/auth/change-passcode-form";
import { getCurrentSession } from "@/server/auth/current-session";
import { isAuthServerConfigured } from "@/server/auth/server";

export const dynamic = "force-dynamic";

export default async function ChangePasscodePage() {
  if (!isAuthServerConfigured()) {
    redirect("/");
  }

  const session = await getCurrentSession();
  if (!session) {
    redirect("/");
  }

  return (
    <main className="foundation-page">
      <header className="brand-bar">
        <span className="brand-mark" aria-hidden="true">
          GO
        </span>
        <div>
          <p className="eyebrow">Secure account</p>
          <p className="brand-name">Guided Operations</p>
        </div>
        <span className="foundation-badge">
          {session.account.mustChangePasscode
            ? "Passcode change required"
            : "Account security"}
        </span>
      </header>

      <section className="account-shell" aria-labelledby="change-passcode-title">
        <div className="account-copy">
          <p className="eyebrow">Individual credential</p>
          <h1 id="change-passcode-title">Choose your personal passcode.</h1>
          <p className="lede">
            {session.account.mustChangePasscode
              ? "Your temporary passcode has done its job. Replace it before entering the workspace."
              : "Changing your passcode revokes every active session for this account, including this one."}
          </p>
        </div>

        <aside className="sign-in-card" aria-label="Change personal passcode">
          <p className="eyebrow">{session.account.displayName}</p>
          <h2>Update passcode</h2>
          <p className="supporting-copy">
            The application stores a memory-hard hash, never the passcode
            itself. After this change, sign in again with the new value.
          </p>
          <ChangePasscodeForm csrfToken={session.csrfToken} />
        </aside>
      </section>

      <footer className="foundation-footer">
        <span>Individual account security</span>
        <span>No shared facility credential</span>
      </footer>
    </main>
  );
}
