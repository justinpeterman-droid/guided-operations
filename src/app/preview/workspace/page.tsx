import Link from "next/link";

const officerTools = [
  {
    eyebrow: "Report assistant",
    title: "Start a clear report",
    copy: "Capture known facts, preserve what is unknown, and review every draft before it becomes a report.",
    href: "/preview/report-assistant",
    action: "Open report assistant",
  },
  {
    eyebrow: "Your history",
    title: "Reports and incidents",
    copy: "Find the work your account is allowed to see. Nothing is replaced with a demo when a record is missing.",
    href: "/reports",
    action: "View report history",
  },
  {
    eyebrow: "Policy assistant",
    title: "Ask a policy question",
    copy: "Answers will show their source. When the evidence is missing, the assistant will say so plainly.",
    href: "/policy-expert",
    action: "Open Policy Expert",
  },
  {
    eyebrow: "Forms library",
    title: "Complete daily paperwork",
    copy: "Use approved forms, review each entry, and print only a clearly marked training copy until the records workflow is approved.",
    href: "/preview/count-sheet",
    action: "Open Count Sheet",
  },
];

/**
 * A non-persistent visual workspace for owner review. It deliberately never
 * creates data or grants access; real officer pages remain session protected.
 */
export default function WorkspacePreviewPage() {
  return (
    <main className="workspace-preview-page">
      <header className="workspace-preview-header">
        <Link className="workspace-brand" href="/">
          <span className="brand-mark" aria-hidden="true">
            GO
          </span>
          <span>
            <span className="eyebrow">Guided Operations</span>
            <strong>Officer workspace</strong>
          </span>
        </Link>
        <span className="preview-status">Fictional training preview</span>
      </header>

      <section
        className="workspace-preview-hero"
        aria-labelledby="workspace-title"
      >
        <div>
          <p className="eyebrow">Officer home</p>
          <h1 id="workspace-title">
            A calm place to begin the next right step.
          </h1>
          <p>
            Reports, forms, history, and policy guidance stay together. You
            remain in control of facts, corrections, and every final decision.
          </p>
        </div>
        <aside className="workspace-preview-safety" aria-label="Safety promise">
          <span aria-hidden="true">✓</span>
          <div>
            <strong>Review first</strong>
            <p>
              Nothing is submitted or made official by this site on its own.
            </p>
          </div>
        </aside>
      </section>

      <section aria-labelledby="tools-title">
        <div className="workspace-section-heading">
          <div>
            <p className="eyebrow">Your tools</p>
            <h2 id="tools-title">What would you like to work on?</h2>
          </div>
          <p>Designed for the workday, not a complicated software menu.</p>
        </div>
        <div className="workspace-tool-grid">
          {officerTools.map((tool, index) => (
            <article className="workspace-tool-card" key={tool.title}>
              <span className="workspace-tool-number" aria-hidden="true">
                0{index + 1}
              </span>
              <p className="eyebrow">{tool.eyebrow}</p>
              <h3>{tool.title}</h3>
              <p>{tool.copy}</p>
              <Link href={tool.href}>
                {tool.action} <span aria-hidden="true">→</span>
              </Link>
            </article>
          ))}
        </div>
      </section>

      <section
        className="workspace-preview-admin"
        aria-labelledby="admin-title"
      >
        <div>
          <p className="eyebrow">Administrator access</p>
          <h2 id="admin-title">Same workspace. Extra responsibility.</h2>
          <p>
            Administrators have the same officer tools, plus a protected roster
            to invite, enable, disable, reset, and assign account roles. Those
            actions require a fresh security check and leave a redacted audit
            record.
          </p>
        </div>
        <Link className="workspace-admin-link" href="/preview/admin">
          View administrator layout <span aria-hidden="true">→</span>
        </Link>
      </section>
    </main>
  );
}
