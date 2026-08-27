import Link from "next/link";

import { PlaceLegalHoldForm } from "@/app/admin/retention/place-legal-hold-form";
import { ReleaseLegalHoldControl } from "@/app/admin/retention/release-legal-hold-control";

const activeHoldId = "11111111-1111-4111-8111-111111111111";

/** Fictional visual contract only; protected APIs still require a real admin. */
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

      <PlaceLegalHoldForm />

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
            <ReleaseLegalHoldControl holdId={activeHoldId} />
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
