import Link from "next/link";

import { PreviewShell } from "@/app/components/preview-shell";

const actions = [
  {
    title: "Roster",
    copy: "Invite and manage individual officer and administrator accounts.",
  },
  {
    title: "Account safety",
    copy: "Disable, reset, unlock, or change a role with a fresh security check.",
  },
  {
    title: "Policy sources",
    copy: "Review approved document versions and citation coverage.",
  },
  {
    title: "System health",
    copy: "See safe, redacted health and backup signals before they become release evidence.",
  },
  {
    title: "Records safety",
    copy: "Place or release legal holds without exposing any deletion action.",
    href: "/preview/admin-retention",
  },
] as const;

/** Visual contract only; no roster or account action is connected here. */
export default function AdministratorPreviewPage() {
  return (
    <PreviewShell
      className="workspace-preview-page admin-preview-page"
      title="Administrator workspace"
    >
      <section className="admin-preview-hero" aria-labelledby="admin-title">
        <p className="eyebrow">Administrator home</p>
        <h1 id="admin-title">
          Support the team without losing the safeguards.
        </h1>
        <p>
          Administrators use the same reports, forms, history, and policy tools
          as officers. The sections below appear only after the role and a fresh
          step-up check are verified.
        </p>
      </section>

      <section
        className="admin-action-list"
        aria-label="Administrator sections"
      >
        {actions.map((action, index) => (
          <article key={action.title}>
            <span aria-hidden="true">{index + 1}</span>
            <div>
              <h2>{action.title}</h2>
              <p>{action.copy}</p>
            </div>
            {"href" in action ? (
              <Link className="reports-home-link" href={action.href}>
                Review fictional layout
              </Link>
            ) : (
              <em>Planned protected area</em>
            )}
          </article>
        ))}
      </section>

      <Link className="workspace-return-link" href="/preview/workspace">
        ← Return to officer workspace layout
      </Link>
    </PreviewShell>
  );
}
