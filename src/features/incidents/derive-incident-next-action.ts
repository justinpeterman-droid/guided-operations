import type { StoredReviewedFact } from "@/features/incidents/schema";
import type { ReportSummary } from "@/server/incidents/list-reports";

import type { DocumentStudioTabId } from "./document-studio-catalog";

export type IncidentNextAction = Readonly<{
  destination: DocumentStudioTabId;
  label: string;
  summary: string;
}>;

export type IncidentNextActionInput = Readonly<{
  reviewedFacts: readonly StoredReviewedFact[];
  reportingOfficerCount: number;
  reports: readonly ReportSummary[] | null;
}>;

function isVisibleConfirmedFact(fact: StoredReviewedFact): boolean {
  if (fact.state !== "confirmed") return false;
  if (!("reportingStaffMemberIds" in fact)) return true;
  return fact.reportingStaffMemberIds.length > 0;
}

export function deriveIncidentNextAction(
  input: IncidentNextActionInput,
): IncidentNextAction | null {
  if (input.reportingOfficerCount === 0) {
    return {
      destination: "incident-record",
      label: "Review incident record",
      summary:
        "No reporting officer is assigned on this revision, so report work cannot be attributed yet.",
    };
  }

  const reviewedExceptionCount = input.reviewedFacts.filter(
    (fact) => fact.state === "unknown" || fact.state === "not_applicable",
  ).length;
  if (reviewedExceptionCount > 0) {
    return {
      destination: "notes-facts",
      label: "Review fact states",
      summary: `${reviewedExceptionCount} reviewed fact ${
        reviewedExceptionCount === 1 ? "state needs" : "states need"
      } attention before another report is requested.`,
    };
  }

  if (!input.reviewedFacts.some(isVisibleConfirmedFact)) {
    return {
      destination: "notes-facts",
      label: "Open Notes & Facts",
      summary: "No confirmed facts are available for an officer report.",
    };
  }

  if (input.reports === null) return null;

  if (input.reports.length === 0) {
    return {
      destination: "reports",
      label: "Open Reports",
      summary:
        "Review the available facts and request the first officer report.",
    };
  }

  if (
    input.reports.some(
      (report) => report.status === "draft" || report.status === "in_review",
    )
  ) {
    return {
      destination: "reports",
      label: "Review report work",
      summary:
        "Open the existing draft or report under review before starting another output.",
    };
  }

  return {
    destination: "reports",
    label: "Open report history",
    summary:
      "Open completed report history or start another supported officer report.",
  };
}
