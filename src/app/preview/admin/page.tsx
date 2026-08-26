import Link from "next/link";

const actions = [
  [
    "Roster",
    "Invite and manage individual officer and administrator accounts.",
  ],
  [
    "Account safety",
    "Disable, reset, unlock, or change a role with a fresh security check.",
  ],
  [
    "Policy sources",
    "Review approved document versions and citation coverage.",
  ],
  [
    "System health",
    "See safe, redacted health and backup signals before they become release evidence.",
  ],
] as const;

/** Visual contract only; no roster or account action is connected here. */
export default function AdministratorPreviewPage() {
  return (
    <main className="workspace-preview-page admin-preview-page">
      <header className="workspace-preview-header">
        <Link className="workspace-brand" href="/preview/workspace">
          <span className="brand-mark" aria-hidden="true">
            GO
          </span>
          <span>
            <span className="eyebrow">Guided Operations</span>
            <strong>Administrator workspace</strong>
          </span>
        </Link>
        <span className="preview-status">Fictional training preview</span>
      </header>

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
        {actions.map(([title, copy], index) => (
          <article key={title}>
            <span aria-hidden="true">{index + 1}</span>
            <div>
              <h2>{title}</h2>
              <p>{copy}</p>
            </div>
            <em>Planned protected area</em>
          </article>
        ))}
      </section>

      <Link className="workspace-return-link" href="/preview/workspace">
        ← Return to officer workspace layout
      </Link>
    </main>
  );
}
