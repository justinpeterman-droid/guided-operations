import Link from "next/link";

import { WorkspaceNavigation } from "@/app/components/workspace-navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  listLegalHoldsForCurrentSession,
  listRetentionReviewForCurrentSession,
  type LegalHoldSummary,
  type RetentionReviewSummary,
} from "@/server/retention/legal-hold";
import { createLegalHoldStore } from "@/server/retention/private-legal-hold-store";

import { PlaceLegalHoldForm } from "./place-legal-hold-form";
import { ReleaseLegalHoldControl } from "./release-legal-hold-control";

export const dynamic = "force-dynamic";

export default async function AdminRetentionPage() {
  const [holdResult, reviewResult] = await Promise.all([
    loadLegalHolds(),
    loadRetentionReview(),
  ]);
  if (holdResult.kind === "denied" || reviewResult.kind === "denied")
    return <AccessRequired />;
  if (holdResult.kind === "unavailable" || reviewResult.kind === "unavailable")
    return <Unavailable />;

  return (
    <main className="reports-page">
      <header className="workspace-header reports-header">
        <Link className="workspace-brand" href="/admin">
          <span className="brand-mark" aria-hidden="true">
            GO
          </span>
          <span>
            <span className="eyebrow">Guided Operations</span>
            <strong>Records controls</strong>
          </span>
        </Link>
        <div className="reports-header-actions">
          <WorkspaceNavigation current="Home" />
          <Link className="reports-home-link" href="/admin">
            Administrator home
          </Link>
        </div>
      </header>

      <section className="reports-intro" aria-labelledby="retention-title">
        <p className="eyebrow">Administrator workspace</p>
        <h1 id="retention-title">Retention and legal holds</h1>
        <p>
          Active holds stop affected records from entering deletion review. This
          page does not delete records and does not approve deletion.
        </p>
      </section>

      <RetentionReviewRegister candidates={reviewResult.candidates} />
      <PlaceLegalHoldForm />
      <LegalHoldRegister holds={holdResult.holds} />
    </main>
  );
}

export async function loadRetentionReview() {
  try {
    return await listRetentionReviewForCurrentSession(
      await createSupabaseServerClient(),
      createLegalHoldStore(),
      { asOf: new Date().toISOString(), limit: 100 },
    );
  } catch {
    return { kind: "unavailable" } as const;
  }
}

function RetentionReviewRegister({
  candidates,
}: Readonly<{ candidates: readonly RetentionReviewSummary[] }>) {
  return (
    <section
      className="reports-list-section"
      aria-labelledby="retention-review-title"
    >
      <h2 id="retention-review-title">Two-year deletion review</h2>
      <p>
        These archived records reached their ordinary review date. This list
        does not approve or perform deletion. Active legal holds always block
        further action.
      </p>
      {candidates.length === 0 ? (
        <div className="reports-empty-state">
          <p>No records have reached the two-year review date.</p>
        </div>
      ) : (
        <div className="reports-list" role="list">
          {candidates.map((candidate) => (
            <article
              className="report-list-item"
              key={`${candidate.recordType}:${candidate.recordId}`}
              role="listitem"
            >
              <div>
                <p className="eyebrow">{reviewLabel(candidate.recordType)}</p>
                <h3>
                  {candidate.activeLegalHold
                    ? "Protected by legal hold"
                    : "Eligible for records review"}
                </h3>
                <p>
                  Target ID: <code>{candidate.recordId}</code>
                </p>
                <p>Archived {formatTime(candidate.archivedAt)}</p>
                <p>Review date {formatTime(candidate.deletionEligibleAt)}</p>
              </div>
              <span className="report-status">
                {candidate.activeLegalHold ? "Hold active" : "Review only"}
              </span>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

export async function loadLegalHolds() {
  try {
    return await listLegalHoldsForCurrentSession(
      await createSupabaseServerClient(),
      createLegalHoldStore(),
      { includeReleased: true, limit: 100 },
    );
  } catch {
    return { kind: "unavailable" } as const;
  }
}

function LegalHoldRegister({
  holds,
}: Readonly<{ holds: readonly LegalHoldSummary[] }>) {
  return (
    <section className="reports-list-section" aria-labelledby="hold-list-title">
      <h2 id="hold-list-title">Legal-hold register</h2>
      {holds.length === 0 ? (
        <div className="reports-empty-state">
          <p>No legal holds are recorded for this facility.</p>
        </div>
      ) : (
        <div className="reports-list" role="list">
          {holds.map((hold) => (
            <article
              className="report-list-item"
              key={hold.holdId}
              role="listitem"
            >
              <div>
                <p className="eyebrow">
                  {hold.releasedAt ? "Released hold" : "Active hold"}
                </p>
                <h3>{scopeLabel(hold.scopeType)}</h3>
                <p>
                  Target ID: <code>{hold.scopeId}</code>
                </p>
                <p>Authority: {hold.authorityReference}</p>
                <p>Placed {formatTime(hold.createdAt)}</p>
                {hold.releasedAt ? (
                  <p>
                    Released {formatTime(hold.releasedAt)} · Authority:{" "}
                    {hold.releaseAuthorityReference}
                  </p>
                ) : null}
              </div>
              {hold.releasedAt ? (
                <span className="report-status">Released</span>
              ) : (
                <ReleaseLegalHoldControl holdId={hold.holdId} />
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function scopeLabel(scopeType: LegalHoldSummary["scopeType"]): string {
  return {
    facility: "Entire facility",
    incident: "Incident",
    report: "Report",
    paperwork_record: "Paperwork record",
    policy_document: "Policy document",
    staff_member: "Staff member",
    user_account: "User account",
  }[scopeType];
}

function reviewLabel(recordType: RetentionReviewSummary["recordType"]): string {
  return {
    incident: "Archived incident",
    report: "Archived report",
    paperwork_record: "Archived paperwork record",
  }[recordType];
}

function formatTime(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(value));
}

function AccessRequired() {
  return (
    <main className="reports-page reports-message-page">
      <section
        className="reports-empty-state"
        aria-labelledby="retention-access-title"
      >
        <p className="eyebrow">Private workspace</p>
        <h1 id="retention-access-title">Administrator access is required.</h1>
        <p>
          Legal-hold controls are available only to a current administrator.
        </p>
        <Link className="reports-home-link" href="/home">
          Return to your workspace
        </Link>
      </section>
    </main>
  );
}

function Unavailable() {
  return (
    <main className="reports-page reports-message-page">
      <section
        className="reports-empty-state"
        aria-labelledby="retention-unavailable-title"
      >
        <p className="eyebrow">Records controls unavailable</p>
        <h1 id="retention-unavailable-title">
          Records controls cannot load right now.
        </h1>
        <p>No legal hold has been changed.</p>
        <Link className="reports-home-link" href="/admin">
          Return to administrator workspace
        </Link>
      </section>
    </main>
  );
}
