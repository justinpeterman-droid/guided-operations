import { PreviewShell } from "@/app/components/preview-shell";

export default function ReportAssistantPreviewPage() {
  return (
    <PreviewShell
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
            <li className="workflow-step is-current">
              <span>1</span>
              <div>
                <strong>Field notes</strong>
                <p>Capture only what the preparer observed.</p>
              </div>
            </li>
            <li className="workflow-step">
              <span>2</span>
              <div>
                <strong>Confirm facts</strong>
                <p>Review each fact before a draft can use it.</p>
              </div>
            </li>
            <li className="workflow-step">
              <span>3</span>
              <div>
                <strong>Review draft</strong>
                <p>Keep the final decision with the officer.</p>
              </div>
            </li>
          </ol>
        </nav>

        <section className="report-stage" aria-labelledby="notes-heading">
          <div className="stage-heading">
            <div>
              <p className="eyebrow">Step 1 of 3</p>
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
            <button disabled type="button">
              Continue to fact review
            </button>
          </div>
        </section>
      </div>

      <section
        className="review-promise"
        aria-labelledby="review-promise-title"
      >
        <p className="eyebrow">How this becomes a working site</p>
        <h2 id="review-promise-title">
          The interface comes first; the safeguards make it usable.
        </h2>
        <div>
          <p>
            <strong>Secure account layer:</strong> private staff access and
            protected sessions are being completed before real data can enter.
          </p>
          <p>
            <strong>Report layer:</strong> confirmed facts, drafts, revisions,
            and printing will be added as reviewable, tested steps.
          </p>
          <p>
            <strong>Policy layer:</strong> the policy assistant will answer only
            from approved documents with visible citations.
          </p>
        </div>
      </section>
    </PreviewShell>
  );
}
