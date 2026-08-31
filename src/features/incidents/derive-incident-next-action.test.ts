import { describe, expect, it } from "vitest";

import type { StoredReviewedFact } from "@/features/incidents/schema";
import type { ReportSummary } from "@/server/incidents/list-reports";

import { DOCUMENT_STUDIO_TABS } from "./document-studio-catalog";
import { deriveIncidentNextAction } from "./derive-incident-next-action";

const confirmedFact: StoredReviewedFact = {
  id: "33333333-3333-4333-8333-333333333333",
  field: "Location",
  state: "confirmed",
  value: "Fictional housing area",
  sourceNoteIds: ["44444444-4444-4444-8444-444444444444"],
  reportingStaffMemberIds: ["55555555-5555-4555-8555-555555555555"],
};

const unknownFact: StoredReviewedFact = {
  id: "77777777-7777-4777-8777-777777777777",
  field: "Time",
  state: "unknown",
  reason: "Not established in the source notes.",
  sourceNoteIds: ["44444444-4444-4444-8444-444444444444"],
};

const unassignedConfirmedFact: StoredReviewedFact = {
  ...confirmedFact,
  id: "88888888-8888-4888-8888-888888888888",
  reportingStaffMemberIds: [],
};

const completedReport: ReportSummary = {
  reportId: "66666666-6666-4666-8666-666666666666",
  incidentNumber: "F-001",
  incidentName: "Fictional incident",
  reportType: "first_person",
  status: "complete",
  currentRevisionNumber: 1,
  updatedAt: "2026-08-31T12:00:00.000Z",
};

describe("Document Studio guidance", () => {
  it("exposes exactly the four approved sections in task order", () => {
    expect(DOCUMENT_STUDIO_TABS.map((tab) => tab.id)).toEqual([
      "reports",
      "notes-facts",
      "paperwork",
      "incident-record",
    ]);
  });

  it("routes a revision with no reporting officer to its incident record", () => {
    expect(
      deriveIncidentNextAction({
        reviewedFacts: [confirmedFact],
        reportingOfficerCount: 0,
        reports: [],
      }),
    ).toEqual({
      destination: "incident-record",
      label: "Review incident record",
      summary:
        "No reporting officer is assigned on this revision, so report work cannot be attributed yet.",
    });
  });

  it("routes reviewed exception states to Notes & Facts", () => {
    expect(
      deriveIncidentNextAction({
        reviewedFacts: [confirmedFact, unknownFact],
        reportingOfficerCount: 1,
        reports: [],
      }),
    ).toEqual({
      destination: "notes-facts",
      label: "Review fact states",
      summary:
        "1 reviewed fact state needs attention before another report is requested.",
    });
  });

  it("does not treat an unattributed confirmed fact as report-ready", () => {
    expect(
      deriveIncidentNextAction({
        reviewedFacts: [unassignedConfirmedFact],
        reportingOfficerCount: 1,
        reports: [],
      }),
    ).toEqual({
      destination: "notes-facts",
      label: "Open Notes & Facts",
      summary: "No confirmed facts are available for an officer report.",
    });
  });

  it("routes the first supported report request to Reports", () => {
    expect(
      deriveIncidentNextAction({
        reviewedFacts: [confirmedFact],
        reportingOfficerCount: 1,
        reports: [],
      }),
    ).toEqual({
      destination: "reports",
      label: "Open Reports",
      summary:
        "Review the available facts and request the first officer report.",
    });
  });

  it("routes active report work back to Reports", () => {
    expect(
      deriveIncidentNextAction({
        reviewedFacts: [confirmedFact],
        reportingOfficerCount: 1,
        reports: [{ ...completedReport, status: "in_review" }],
      }),
    ).toEqual({
      destination: "reports",
      label: "Review report work",
      summary:
        "Open the existing draft or report under review before starting another output.",
    });
  });

  it("routes completed work to report history without claiming filing", () => {
    expect(
      deriveIncidentNextAction({
        reviewedFacts: [confirmedFact],
        reportingOfficerCount: 1,
        reports: [completedReport],
      }),
    ).toEqual({
      destination: "reports",
      label: "Open report history",
      summary:
        "Open completed report history or start another supported officer report.",
    });
  });
});
