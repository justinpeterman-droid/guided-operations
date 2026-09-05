import Link from "next/link";

import { PreviewShell } from "@/app/components/preview-shell";

export const metadata = {
  title: "Administrator preview",
};

const actions = [
  {
    title: "Roster and accounts",
    copy: "Invite and manage individual officer and administrator accounts.",
  },
  {
    title: "Daily paperwork",
    copy: "Review the source-package layout for the six daily forms.",
    href: "/preview/admin-paperwork-packages",
  },
  {
    title: "Suggestions and form review",
    copy: "Review officer feedback and blank form requests before publication.",
  },
  {
    title: "System health",
    copy: "Review safe service status and activity in the protected administrator workspace.",
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
          as officers. These layouts use fictional examples. Live administrator
          pages verify the current role, and account changes require a fresh
          passcode confirmation.
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
              <em>Available in the protected workspace</em>
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
