import { Button } from "@/components/ui/button";

import { PreviewShell } from "@/app/components/preview-shell";

export const metadata = {
  title: "Report Assistant preview",
};

export default function ReportAssistantPreviewPage() {
  return (
    <PreviewShell
      current="Report Assistant"
      brandHref="/"
      className="workspace-page"
      title="Report assistant"
    >
      <section className="workspace-intro" aria-labelledby="workspace-title">
        <p className="eyebrow">Review-first report drafting</p>
        <h1 id="workspace-title">Start with what is known.</h1>
        <p>
          This is a visual prototype only. Nothing on this page is saved,
          submitted, or sent to AI. The sample labels are intentionally
          fictional and contain no operational information.
        </p>
      </section>

      <div className="report-workspace">
        <nav className="workflow-steps" aria-label="Report workflow">
          <p className="eyebrow">Workflow</p>
          <ol>
            {[
              "Officers",
              "Field notes",
              "Review facts",
              "Missing information",
              "Reports",
              "Forms & Export",
            ].map((label, index) => (
              <li
                className={`workflow-step ${index === 1 ? "is-current" : ""}`}
                key={label}
                aria-current={index === 1 ? "step" : undefined}
              >
                <span>{index + 1}</span>
                <strong>{label}</strong>
              </li>
            ))}
          </ol>
        </nav>

        <section className="report-stage" aria-labelledby="notes-heading">
          <div className="stage-heading">
            <div>
              <p className="eyebrow">Step 2 of 6</p>
              <h2 id="notes-heading">Field notes</h2>
            </div>
            <span className="not-saved-label">Not saved</span>
          </div>

          <div className="fictional-notice" role="note">
            <strong>Fictional example only.</strong> Real reports require a
            signed-in account and will be stored only after you explicitly save.
          </div>

          <div className="report-fields">
            <label>
              Incident number
              <input disabled value="Fictional example" readOnly />
            </label>
            <label>
              Incident name
              <input disabled value="Training scenario" readOnly />
            </label>
            <label className="full-width">
              Your field notes
              <textarea
                className="resize-vertical"
                disabled
                value="This fictional workspace will preserve unknown or missing information instead of filling it in."
                readOnly
              />
            </label>
          </div>

          <div className="stage-footer">
            <p>
              Missing information stays visible. It cannot be guessed by the
              report assistant.
            </p>
            <div className="go-ui">
              <Button disabled type="button">
                Continue to fact review
              </Button>
            </div>
          </div>
        </section>
      </div>

      <section
        className="review-promise"
        aria-labelledby="review-promise-title"
      >
        <p className="eyebrow">Your review stays in control</p>
        <h2 id="review-promise-title">From your notes to a reviewed report.</h2>
        <div>
          <p>
            <strong>Confirm the facts:</strong> Review proposed facts and leave
            out anything that is not supported by your notes.
          </p>
          <p>
            <strong>Keep gaps visible:</strong> Required questions and unknown
            information stay visible through review.
          </p>
          <p>
            <strong>Review before saving:</strong> Check the report package and
            forms before choosing to save. This preview saves nothing.
          </p>
        </div>
      </section>
    </PreviewShell>
  );
}
