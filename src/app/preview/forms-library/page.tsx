import Link from "next/link";

const formGroups = [
  {
    title: "Available for training review",
    items: [
      {
        name: "Count Sheet",
        detail:
          "A fictional, clearly marked practice version is ready to review and print. It does not become an official form.",
        action: "Open Count Sheet",
        href: "/preview/count-sheet",
      },
    ],
  },
  {
    title: "Waiting for approved source forms",
    items: [
      {
        name: "Daily paperwork",
        detail:
          "The screen and save rules will be built after each source form, its current version, and its use are reviewed.",
      },
      {
        name: "Monthly packets",
        detail:
          "These will be added only after their print layout and record rules are approved.",
      },
    ],
  },
] as const;

/**
 * Honest visual contract for the future Forms Library. It contains no copied
 * forms, real records, or invented paper workflows.
 */
export default function FormsLibraryPreviewPage() {
  return (
    <main className="forms-library-page">
      <header className="workspace-preview-header">
        <Link className="workspace-brand" href="/preview/workspace">
          <span className="brand-mark" aria-hidden="true">
            GO
          </span>
          <span>
            <span className="eyebrow">Guided Operations</span>
            <strong>Forms Library</strong>
          </span>
        </Link>
        <span className="preview-status">Fictional training preview</span>
      </header>

      <section className="forms-library-intro" aria-labelledby="forms-title">
        <p className="eyebrow">Forms Library</p>
        <h1 id="forms-title">Use the right form, with the right limits.</h1>
        <p>
          This library will help officers find approved paperwork without
          pretending every paper process can be safely replaced by a website.
        </p>
      </section>

      {formGroups.map((group) => (
        <section className="forms-library-group" key={group.title}>
          <h2>{group.title}</h2>
          <div className="forms-library-list">
            {group.items.map((item) => (
              <article key={item.name}>
                <div>
                  <h3>{item.name}</h3>
                  <p>{item.detail}</p>
                </div>
                {"href" in item ? (
                  <Link href={item.href}>
                    {item.action} <span aria-hidden="true">→</span>
                  </Link>
                ) : (
                  <span className="forms-not-ready">Not ready yet</span>
                )}
              </article>
            ))}
          </div>
        </section>
      ))}

      <aside className="forms-library-warning" aria-labelledby="paper-title">
        <p className="eyebrow">Paper-only work stays paper-only</p>
        <h2 id="paper-title">Some work should not move into the app.</h2>
        <p>
          Physical-only workflows will remain clearly labeled. This site will
          never turn them into a fake digital replacement.
        </p>
      </aside>
    </main>
  );
}
