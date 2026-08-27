import Link from "next/link";

/** Fictional visual contract only. Every control is deliberately inert. */
export default function AdminRetentionPreviewPage() {
  return (
    <main className="reports-page">
      <header className="workspace-header reports-header">
        <Link className="workspace-brand" href="/preview/admin">
          <span className="brand-mark" aria-hidden="true">
            GO
          </span>
          <span>
            <span className="eyebrow">Guided Operations</span>
            <strong>Records controls</strong>
          </span>
        </Link>
        <span className="preview-status">Fictional training preview</span>
      </header>

      <section
        className="reports-intro"
        aria-labelledby="preview-retention-title"
      >
        <p className="eyebrow">Administrator workspace</p>
        <h1 id="preview-retention-title">Retention and legal holds</h1>
        <p>
          Visual review only. The example below is fictional, and this preview
          cannot read, change, or delete any operational record.
        </p>
      </section>

      <section
        className="reports-list-section"
        aria-labelledby="preview-retention-review-title"
      >
        <h2 id="preview-retention-review-title">Two-year deletion review</h2>
        <p>
          Fictional example only. This read-only list cannot approve or perform
          deletion.
        </p>
        <div className="reports-list" role="list">
          <article className="report-list-item" role="listitem">
            <div>
              <p className="eyebrow">Archived incident</p>
              <h3>Protected by legal hold</h3>
              <p>
                Target ID: <code>44444444-4444-4444-8444-444444444444</code>
              </p>
              <p>Archived Jan 1, 2024, 3:00 AM UTC</p>
              <p>Review date Dec 31, 2025, 3:00 AM UTC</p>
            </div>
            <span className="report-status">Hold active</span>
          </article>
        </div>
      </section>

      <section
        className="reports-list-section"
        aria-labelledby="preview-place-hold-title"
      >
        <h2 id="preview-place-hold-title">Place a legal hold</h2>
        <p>
          This disabled example shows the information an administrator will use.
          It cannot send a request or change a record.
        </p>
        <form className="account-session-confirm">
          <label htmlFor="preview-legal-hold-scope">Record type</label>
          <select id="preview-legal-hold-scope" disabled>
            <option>Incident</option>
          </select>
          <label htmlFor="preview-legal-hold-scope-id">Target record ID</label>
          <input
            id="preview-legal-hold-scope-id"
            disabled
            placeholder="00000000-0000-4000-8000-000000000000"
            type="text"
          />
          <label htmlFor="preview-legal-hold-authority">
            Authority reference
          </label>
          <input
            id="preview-legal-hold-authority"
            disabled
            placeholder="FICTIONAL-HOLD-001"
            type="text"
          />
          <button disabled type="button">
            Confirm legal hold
          </button>
          <p className="account-session-message">Preview only — disabled</p>
        </form>
      </section>

      <section
        className="reports-list-section"
        aria-labelledby="preview-hold-list-title"
      >
        <h2 id="preview-hold-list-title">Legal-hold register</h2>
        <div className="reports-list" role="list">
          <article className="report-list-item" role="listitem">
            <div>
              <p className="eyebrow">Active hold</p>
              <h3>Fictional incident</h3>
              <p>
                Target ID: <code>22222222-2222-4222-8222-222222222222</code>
              </p>
              <p>Authority: FICTIONAL-HOLD-001</p>
              <p>Placed Aug 27, 2026, 3:00 AM UTC</p>
            </div>
            <button disabled type="button">
              Release hold
            </button>
          </article>
          <article className="report-list-item" role="listitem">
            <div>
              <p className="eyebrow">Released hold</p>
              <h3>Fictional paperwork record</h3>
              <p>
                Target ID: <code>33333333-3333-4333-8333-333333333333</code>
              </p>
              <p>Authority: FICTIONAL-HOLD-002</p>
              <p>Released Aug 27, 2026, 4:00 AM UTC</p>
            </div>
            <span className="report-status">Released</span>
          </article>
        </div>
      </section>

      <Link className="workspace-return-link" href="/preview/admin">
        ← Return to administrator preview
      </Link>
    </main>
  );
}
