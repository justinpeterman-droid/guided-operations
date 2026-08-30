import Link from "next/link";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getReportForCurrentSession } from "@/server/incidents/get-report";
import { listReportRevisionsForCurrentSession } from "@/server/incidents/list-report-revisions";

import { DownloadReportButton } from "./download-report-button";
import { ReportHistory } from "./report-history";
import { PrintReportButton } from "./print-report-button";
import { ReportRevisionForm } from "./report-revision-form";

export const dynamic = "force-dynamic";

export default async function ReportPage({
  params,
}: {
  params: Promise<{ reportId: string }>;
}) {
  const { reportId } = await params;
  const result = await loadReport(reportId);

  if (result.kind === "denied")
    return <Message title="Sign in to view this report." />;
  if (result.kind === "not_found")
    return <Message title="Report unavailable." />;
  if (result.kind === "unavailable")
    return <Message title="Report cannot be loaded right now." />;

  return (
    <main className="reports-page">
      <header className="workspace-header reports-header">
        <Link className="workspace-brand" href="/reports">
          <span className="brand-mark" aria-hidden="true">
            GO
          </span>
          <span>
            <span className="eyebrow">Guided Operations</span>
            <strong>Final report</strong>
          </span>
        </Link>
        <div className="reports-header-actions">
          <Link className="reports-home-link" href="/reports">
            Reports
          </Link>
          {isPrintableReport(result.report.reportType) ? (
            <>
              <DownloadReportButton
                current
                reportId={result.report.reportId}
                revisionNumber={result.report.revisionNumber}
              />
              <PrintReportButton
                reportId={result.report.reportId}
                revisionNumber={result.report.revisionNumber}
              />
            </>
          ) : null}
        </div>
      </header>
      <section
        className="reports-intro report-print-heading"
        aria-labelledby="report-title"
      >
        <p className="eyebrow">Human-reviewed record</p>
        <h1 id="report-title">Final report</h1>
        <p>
          Revision {result.report.revisionNumber} · {result.report.reportType}
        </p>
      </section>
      <article
        className="draft-review-card"
        aria-label="Final report narrative"
      >
        <div className="draft-review-meta">
          <span>Current immutable revision</span>
          <time dateTime={result.report.createdAt}>
            Created{" "}
            {new Intl.DateTimeFormat("en-US", {
              dateStyle: "medium",
              timeStyle: "short",
              timeZone: "UTC",
            }).format(new Date(result.report.createdAt))}{" "}
            UTC
          </time>
        </div>
        <div className="draft-review-copy">
          <p>{result.report.narrative}</p>
        </div>
        <ReportRevisionForm
          initialNarrative={result.report.narrative}
          reportId={reportId}
          revisionNumber={result.report.revisionNumber}
        />
        <ReportHistory
          allowDownload={isPrintableReport(result.report.reportType)}
          currentRevisionNumber={result.report.revisionNumber}
          reportId={reportId}
          revisions={await loadHistory(reportId)}
        />
      </article>
    </main>
  );
}

function isPrintableReport(reportType: string) {
  return reportType === "first_person" || reportType === "cover_letter";
}

async function loadHistory(reportId: string) {
  try {
    const result = await listReportRevisionsForCurrentSession(
      reportId,
      await createSupabaseServerClient(),
    );
    return result.kind === "listed" ? result.revisions : [];
  } catch {
    return [];
  }
}

async function loadReport(reportId: string) {
  try {
    return await getReportForCurrentSession(
      reportId,
      await createSupabaseServerClient(),
    );
  } catch {
    return { kind: "unavailable" } as const;
  }
}

function Message({ title }: { title: string }) {
  return (
    <main className="reports-page reports-message-page">
      <section className="reports-empty-state">
        <p className="eyebrow">Private workspace</p>
        <h1>{title}</h1>
        <p>Your existing work has not been changed.</p>
        <Link className="reports-home-link" href="/reports">
          Return to reports
        </Link>
      </section>
    </main>
  );
}
