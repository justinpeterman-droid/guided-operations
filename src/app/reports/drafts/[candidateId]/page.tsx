import Link from "next/link";

import { WorkspaceShell } from "@/app/components/workspace-shell";
import {
  OfficerSignInRequiredMessage,
  OfficerUnavailableMessage,
} from "@/app/components/workspace-message-presets";
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
    <WorkspaceShell current="Reports" title="Report review">
      <section className="reports-intro" aria-labelledby="draft-title">
        <p className="eyebrow">Review-only candidate</p>
        <h1 id="draft-title">Review every drafted statement.</h1>
        <p>
          This is not a submitted report. Each paragraph names the confirmed
          fact IDs it used. You may edit the narrative and explicitly create a
          final report only after your review.
        </p>
        <p>
          <Link
            className="reports-home-link"
            href={`/incidents/${result.candidate.incidentId}`}
          >
            Open Document Studio for this incident
          </Link>
        </p>
      </section>

      <section className="draft-review-card" aria-labelledby="draft-copy-title">
        <div className="draft-review-meta">
          <span className="not-saved-label">Unreviewed draft</span>
          <span>Report type: {result.candidate.reportType}</span>
          <span>
            Reporting officer: {result.candidate.reportingOfficerDisplayName}
          </span>
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
    </WorkspaceShell>
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
    <OfficerSignInRequiredMessage
      description="Draft candidates are available only to an authorized private account."
      title="Sign in to review a draft."
    />
  );
}

function NotFound() {
  return (
    <OfficerUnavailableMessage
      actions={[{ href: "/reports", label: "Return to reports" }]}
      description="This draft does not exist or is not available to this account."
      eyebrow="Private workspace"
      title="Draft unavailable."
    />
  );
}

function Unavailable() {
  return (
    <OfficerUnavailableMessage
      actions={[{ href: "/reports", label: "Return to reports" }]}
      description="Your existing work has not been changed. Please try again later."
      eyebrow="Private workspace"
      title="Draft review is unavailable."
    />
  );
}
