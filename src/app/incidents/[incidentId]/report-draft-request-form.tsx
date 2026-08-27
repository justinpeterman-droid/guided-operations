"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import {
  getReportTypeDefinition,
  REPORT_TYPES,
  type ReportType,
} from "@/features/incidents/report-types";
import type { StoredReviewedFact } from "@/features/incidents/schema";
import type {
  IncidentReportWorkspace,
  ReportingOfficerSelection,
} from "@/server/incidents/get-incident-report-workspace";

import styles from "./report-draft-request-form.module.css";

type SubmitState = "idle" | "submitting" | "failed";
type ScopedConfirmedFact = Extract<
  StoredReviewedFact,
  { reportingStaffMemberIds: string[] }
>;

async function csrfToken(): Promise<string> {
  const response = await fetch("/api/auth/csrf", {
    credentials: "same-origin",
    cache: "no-store",
  });
  if (!response.ok) throw new Error("CSRF unavailable");
  const body = (await response.json()) as { csrfToken?: unknown };
  if (typeof body.csrfToken !== "string") throw new Error("CSRF unavailable");
  return body.csrfToken;
}

function officerLabel(officer: ReportingOfficerSelection): string {
  return `${officer.displayName} · employee ending ${officer.employeeNumberHint}${officer.shiftCode ? ` · ${officer.shiftCode} shift` : ""}`;
}

export function ReportDraftRequestForm({
  workspace,
}: {
  workspace: IncidentReportWorkspace;
}) {
  const router = useRouter();
  const [reportingStaffMemberId, setReportingStaffMemberId] = useState(
    workspace.reportingOfficers.length === 1
      ? workspace.reportingOfficers[0].staffMemberId
      : "",
  );
  const [reportType, setReportType] = useState<ReportType>("first_person");
  const [selectedFactIds, setSelectedFactIds] = useState<ReadonlySet<string>>(
    new Set(),
  );
  const [submitState, setSubmitState] = useState<SubmitState>("idle");

  const eligibleFacts = useMemo(
    () =>
      workspace.reviewedFacts.filter(
        (fact): fact is ScopedConfirmedFact =>
          fact.state === "confirmed" &&
          "reportingStaffMemberIds" in fact &&
          fact.reportingStaffMemberIds.includes(reportingStaffMemberId),
      ),
    [reportingStaffMemberId, workspace.reviewedFacts],
  );

  function chooseReporter(staffMemberId: string) {
    setReportingStaffMemberId(staffMemberId);
    setSelectedFactIds(new Set());
    setSubmitState("idle");
  }

  function toggleFact(factId: string) {
    setSelectedFactIds((current) => {
      const next = new Set(current);
      if (next.has(factId)) next.delete(factId);
      else next.add(factId);
      return next;
    });
    setSubmitState("idle");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!reportingStaffMemberId || selectedFactIds.size === 0) return;
    setSubmitState("submitting");

    try {
      const token = await csrfToken();
      const response = await fetch("/api/web/v1/report-drafts", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "content-type": "application/json",
          "x-csrf-token": token,
          "idempotency-key": crypto.randomUUID().replaceAll("-", ""),
        },
        body: JSON.stringify({
          request: {
            schemaVersion: 2,
            incidentId: workspace.incidentId,
            sourceIncidentRevisionId: workspace.incidentRevisionId,
            reportingStaffMemberId,
            reportType,
            confirmedFactIds: [...selectedFactIds],
          },
          sourceRevisionNumber: workspace.revisionNumber,
        }),
      });
      const body = (await response.json()) as {
        data?: { candidateId?: unknown };
      };
      if (!response.ok || typeof body.data?.candidateId !== "string") {
        setSubmitState("failed");
        return;
      }
      router.push(`/reports/drafts/${body.data.candidateId}`);
    } catch {
      setSubmitState("failed");
    }
  }

  if (workspace.schemaVersion !== 2) {
    return (
      <p role="note">
        This older incident remains readable, but its facts were not assigned to
        reporting officers. Create a reviewed current revision before requesting
        a new draft.
      </p>
    );
  }

  if (workspace.reportingOfficers.length === 0) {
    return (
      <p role="alert">
        No active reporting officer is available on this revision. No draft can
        be requested until the attribution is corrected in a new revision.
      </p>
    );
  }

  return (
    <form className="incident-stage" onSubmit={submit}>
      <section className="incident-review">
        <h2>1. Choose the reporting officer</h2>
        <p>
          The draft will use only facts that were approved for this officer.
          Preparing the draft does not change who authored the report.
        </p>
        <div className={styles.optionGrid}>
          {workspace.reportingOfficers.map((officer) => (
            <label className={styles.option} key={officer.staffMemberId}>
              <input
                className={styles.choice}
                checked={reportingStaffMemberId === officer.staffMemberId}
                name="reporting-officer"
                onChange={() => chooseReporter(officer.staffMemberId)}
                type="radio"
              />
              {officerLabel(officer)}
            </label>
          ))}
        </div>
      </section>

      <section className="incident-review">
        <h2>2. Choose confirmed facts</h2>
        {!reportingStaffMemberId ? (
          <p>Choose a reporting officer to see that officer&apos;s facts.</p>
        ) : eligibleFacts.length === 0 ? (
          <p role="alert">
            No confirmed facts were approved for this reporting officer.
          </p>
        ) : (
          <div className={styles.optionGrid}>
            {eligibleFacts.map((fact) => (
              <label className={styles.option} key={fact.id}>
                <input
                  className={styles.choice}
                  checked={selectedFactIds.has(fact.id)}
                  onChange={() => toggleFact(fact.id)}
                  type="checkbox"
                />
                <span className={styles.factText}>
                  <strong>{fact.field}</strong>
                  {fact.value}
                </span>
              </label>
            ))}
          </div>
        )}
      </section>

      <section className="incident-review">
        <h2>3. Choose the report type</h2>
        <label className={styles.selectLabel}>
          Report type
          <select
            className={styles.select}
            onChange={(event) => {
              setReportType(event.target.value as ReportType);
              setSubmitState("idle");
            }}
            value={reportType}
          >
            {REPORT_TYPES.map((type) => (
              <option key={type} value={type}>
                {getReportTypeDefinition(type).label}
              </option>
            ))}
          </select>
        </label>
      </section>

      <button
        className="incident-primary"
        disabled={
          submitState === "submitting" ||
          !reportingStaffMemberId ||
          selectedFactIds.size === 0
        }
        type="submit"
      >
        {submitState === "submitting"
          ? "Creating review draft…"
          : "Create review draft"}
      </button>
      <p aria-live="polite" className="incident-status">
        {submitState === "failed"
          ? "The draft could not be created. Your incident was not changed."
          : "Generated text remains a review-only draft until an officer corrects and finalizes it."}
      </p>
    </form>
  );
}
