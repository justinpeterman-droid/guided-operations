import Link from "next/link";

import {
  AdminAccountLink,
  AdminShell,
} from "@/app/components/admin-shell";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { authorizeCurrentSession } from "@/server/auth/current-session";

export const dynamic = "force-dynamic";

/**
 * Server-protected administrator entrance. It intentionally exposes no roster
 * data or account-changing action until the separate step-up workflow exists.
 */
export default async function AdminPage() {
  const access = await loadAdminAccess();
  if (access === "unavailable") return <Unavailable />;
  if (access === "denied") return <AccessRequired />;

  return (
    <AdminShell
      actions={<AdminAccountLink />}
      className="workspace-preview-page admin-preview-page"
      title="Administrator workspace"
    >
      <section className="admin-preview-hero" aria-labelledby="admin-title">
        <p className="eyebrow">Administrator home</p>
        <h1 id="admin-title">
          Support the team without losing the safeguards.
        </h1>
        <p>
          This page is available only to a current administrator account. The
          roster and account controls are being added with extra checks so a
          person cannot accidentally enable, disable, or reset the wrong
          account.
        </p>
      </section>

      <section
        className="admin-action-list"
        aria-label="Administrator sections"
      >
        <article>
          <span aria-hidden="true">1</span>
          <div>
            <h2>Daily Paperwork</h2>
            <p>Choose a date and shift, then review the six protected forms.</p>
          </div>
          <Link className="reports-home-link" href="/admin/paperwork/daily">
            View Daily Paperwork
          </Link>
        </article>
        <article>
          <span aria-hidden="true">2</span>
          <div>
            <h2>Roster and accounts</h2>
            <p>View the protected account list and prepare safe changes.</p>
          </div>
          <Link className="reports-home-link" href="/admin/accounts">
            View accounts
          </Link>
        </article>
        <article>
          <span aria-hidden="true">3</span>
          <div>
            <h2>Audit and health</h2>
            <p>Review safe activity and live service readiness.</p>
          </div>
          <div className="admin-section-links">
            <Link className="reports-home-link" href="/admin/audit">
              View activity
            </Link>
            <Link className="reports-home-link" href="/admin/health">
              View health
            </Link>
          </div>
        </article>
        <article>
          <span aria-hidden="true">4</span>
          <div>
            <h2>Retention and legal holds</h2>
            <p>
              Place or release protected holds without exposing any deletion
              action.
            </p>
          </div>
          <Link className="reports-home-link" href="/admin/retention">
            View records controls
          </Link>
        </article>
      </section>
    </AdminShell>
  );
}

export async function loadAdminAccess(): Promise<
  "authorized" | "denied" | "unavailable"
> {
  try {
    const session = await authorizeCurrentSession(
      await createSupabaseServerClient(),
      { requiredRole: "administrator" },
    );
    return session.allowed ? "authorized" : "denied";
  } catch {
    return "unavailable";
  }
}

function AccessRequired() {
  return (
    <main className="reports-page reports-message-page">
      <section
        className="reports-empty-state"
        aria-labelledby="admin-access-title"
      >
        <p className="eyebrow">Private workspace</p>
        <h1 id="admin-access-title">Administrator access is required.</h1>
        <p>This area is available only to a current administrator account.</p>
        <Link className="reports-home-link" href="/home">
          Return to your workspace
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
        aria-labelledby="admin-unavailable-title"
      >
        <p className="eyebrow">Administrator workspace unavailable</p>
        <h1 id="admin-unavailable-title">This page cannot load right now.</h1>
        <p>No account settings have been changed.</p>
        <Link className="reports-home-link" href="/home">
          Return to your workspace
        </Link>
      </section>
    </main>
  );
}
