import Link from "next/link";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getReportDraftCandidateForCurrentSession } from "@/server/ai/get-report-draft-candidate";

import { ReportFinalizationForm } from "./report-finalization-form";

export const dynamic = "force-dynamic";

export default async function ReportDraftReviewPage({
  params,
}: {
  params: Promise<{ candidateId: string }>;
}) {
  const { candidateId } = await params;
  const result = await loadCandidate(candidateId);

  if (result.kind === "denied") return <SignInRequired />;
  if (result.kind === "unavailable") return <Unavailable />;
  if (result.kind === "not_found") return <NotFound />;

  return (
    <main className="reports-page">
      <header className="workspace-header reports-header">
        <Link className="workspace-brand" href="/reports">
          <span className="brand-mark" aria-hidden="true">
            GO
          </span>
          <span>
            <span className="eyebrow">Guided Operations</span>
            <strong>Report review</strong>
          </span>
        </Link>
        <Link className="reports-home-link" href="/reports">
          Reports
        </Link>
      </header>

      <section className="reports-intro" aria-labelledby="draft-title">
        <p className="eyebrow">Review-only candidate</p>
        <h1 id="draft-title">Review every drafted statement.</h1>
        <p>
          This is not a submitted report. Each paragraph names the confirmed
          fact IDs it used. You may edit the narrative and explicitly create a
          final report only after your review.
        </p>
      </section>

      <section className="draft-review-card" aria-labelledby="draft-copy-title">
        <div className="draft-review-meta">
          <span className="not-saved-label">Unreviewed draft</span>
          <span>Report type: {result.candidate.reportType}</span>
          <time dateTime={result.candidate.createdAt}>
            Created{" "}
            {new Intl.DateTimeFormat("en-US", {
              dateStyle: "medium",
              timeStyle: "short",
              timeZone: "UTC",
            }).format(new Date(result.candidate.createdAt))}{" "}
            UTC
          </time>
        </div>
        <h2 id="draft-copy-title">Draft copy</h2>
        <div className="draft-review-copy">
          {result.candidate.paragraphs.map((paragraph, index) => (
            <article key={`${paragraph.text}-${index}`}>
              <p>{paragraph.text}</p>
              <p className="draft-fact-refs">
                Supports: {paragraph.sourceFactIds.join(", ")}
              </p>
            </article>
          ))}
        </div>
        <aside className="draft-review-warning" role="note">
          <strong>Before anything becomes final:</strong> compare each sentence
          to the confirmed facts, keep missing information visible, and make
          your own corrections.
        </aside>
        <ReportFinalizationForm
          candidateId={result.candidate.candidateId}
          initialNarrative={result.candidate.paragraphs
            .map((paragraph) => paragraph.text)
            .join("\n\n")}
        />
      </section>
    </main>
  );
}

async function loadCandidate(candidateId: string) {
  try {
    return await getReportDraftCandidateForCurrentSession(
      candidateId,
      await createSupabaseServerClient(),
    );
  } catch {
    return { kind: "unavailable" } as const;
  }
}

function SignInRequired() {
  return (
    <Message
      title="Sign in to review a draft."
      detail="Draft candidates are available only to an authorized private account."
    />
  );
}

function NotFound() {
  return (
    <Message
      title="Draft unavailable."
      detail="This draft does not exist or is not available to this account."
    />
  );
}

function Unavailable() {
  return (
    <Message
      title="Draft review is unavailable."
      detail="Your existing work has not been changed. Please try again later."
    />
  );
}

function Message({ title, detail }: { title: string; detail: string }) {
  return (
    <main className="reports-page reports-message-page">
      <section className="reports-empty-state">
        <p className="eyebrow">Private workspace</p>
        <h1>{title}</h1>
        <p>{detail}</p>
        <Link className="reports-home-link" href="/reports">
          Return to reports
        </Link>
      </section>
    </main>
  );
}
