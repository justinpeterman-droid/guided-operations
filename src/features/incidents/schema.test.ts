import { describe, expect, it } from "vitest";

import { buildReportChecklistReviewedItems } from "./report-assistant-checklist";

import {
  INCIDENT_SCHEMA_VERSION,
  incidentRevisionInputSchema,
  reportDraftRequestSchema,
} from "./schema";

const noteId = "11111111-1111-4111-8111-111111111111";
const confirmedFactId = "22222222-2222-4222-8222-222222222222";
const unknownFactId = "33333333-3333-4333-8333-333333333333";
const reportingStaffMemberId = "66666666-6666-4666-8666-666666666666";

const incidentRevision = {
  schemaVersion: INCIDENT_SCHEMA_VERSION,
  incidentName: "Fictional training scenario",
  incidentNumber: "TRAINING-001",
  occurredAt: "2026-08-25T15:30:00-05:00",
  category: "training",
  fieldNotes: [
    {
      id: noteId,
      text: "This is a fictional qualification note.",
      recordedAt: "2026-08-25T15:31:00-05:00",
    },
  ],
  reviewedFacts: [
    {
      id: confirmedFactId,
      field: "Location",
      state: "confirmed",
      value: "Training room",
      sourceNoteIds: [noteId],
      reportingStaffMemberIds: [reportingStaffMemberId],
    },
    {
      id: unknownFactId,
      field: "Witness statement",
      state: "unknown",
      reason: "No fictional witness was included in this scenario.",
    },
  ],
};

describe("incident revision contract", () => {
  it("accepts confirmed facts and explicit unknowns with provenance", () => {
    expect(incidentRevisionInputSchema.parse(incidentRevision)).toMatchObject({
      reviewedFacts: [
        { state: "confirmed", sourceNoteIds: [noteId] },
        { state: "unknown" },
      ],
    });
  });

  it("rejects a confirmed fact without a source note", () => {
    const withoutProvenance = {
      ...incidentRevision,
      reviewedFacts: [
        {
          id: confirmedFactId,
          field: "Location",
          state: "confirmed",
          value: "Training room",
          sourceNoteIds: [],
          reportingStaffMemberIds: [reportingStaffMemberId],
        },
      ],
    };

    expect(
      incidentRevisionInputSchema.safeParse(withoutProvenance).success,
    ).toBe(false);
  });

  it("rejects duplicate fact identifiers", () => {
    const duplicateFact = {
      ...incidentRevision,
      reviewedFacts: [
        incidentRevision.reviewedFacts[0],
        {
          id: confirmedFactId,
          field: "Witness statement",
          state: "unknown",
          reason: "No fictional witness was included in this scenario.",
        },
      ],
    };

    expect(incidentRevisionInputSchema.safeParse(duplicateFact).success).toBe(
      false,
    );
  });

  it("rejects duplicate reporting officer scopes", () => {
    expect(
      incidentRevisionInputSchema.safeParse({
        ...incidentRevision,
        reviewedFacts: [
          {
            ...incidentRevision.reviewedFacts[0],
            reportingStaffMemberIds: [
              reportingStaffMemberId,
              reportingStaffMemberId,
            ],
          },
        ],
      }).success,
    ).toBe(false);
  });

  it("rejects duplicate notes and fact provenance from another revision", () => {
    expect(
      incidentRevisionInputSchema.safeParse({
        ...incidentRevision,
        fieldNotes: [
          ...incidentRevision.fieldNotes,
          incidentRevision.fieldNotes[0],
        ],
      }).success,
    ).toBe(false);
    expect(
      incidentRevisionInputSchema.safeParse({
        ...incidentRevision,
        reviewedFacts: [
          {
            ...incidentRevision.reviewedFacts[0],
            sourceNoteIds: ["44444444-4444-4444-8444-444444444444"],
          },
        ],
      }).success,
    ).toBe(false);
  });

  it("binds candidate checklist facts to one complete controlled category", () => {
    const ids = [
      "44444444-4444-4444-8444-444444444444",
      "55555555-5555-4555-8555-555555555555",
    ];
    const checklist = buildReportChecklistReviewedItems({
      categoryKey: "incident_no_disciplinary",
      answers: [
        { questionId: "medical_disposition", state: "unknown" },
        { questionId: "investigation_occurred", state: "unknown" },
      ],
      recordedAt: "2026-08-25T15:31:00-05:00",
      idFactory: () => ids.shift() ?? "",
      reportingStaffMemberIdsByQuestionId: {},
    });
    const candidateRevision = {
      ...incidentRevision,
      category: "incident_no_disciplinary",
      reviewedFacts: checklist.reviewedFacts,
    };

    expect(
      incidentRevisionInputSchema.safeParse(candidateRevision).success,
    ).toBe(true);
    expect(
      incidentRevisionInputSchema.safeParse({
        ...candidateRevision,
        category: "contraband",
      }).success,
    ).toBe(false);
  });
});

describe("report draft contract", () => {
  const draftRequest = {
    schemaVersion: INCIDENT_SCHEMA_VERSION,
    incidentId: "44444444-4444-4444-8444-444444444444",
    sourceIncidentRevisionId: "55555555-5555-4555-8555-555555555555",
    reportingStaffMemberId,
    reportType: "cover_letter",
    confirmedFactIds: [confirmedFactId],
  };

  it("accepts a draft request that references confirmed facts by opaque ID", () => {
    expect(reportDraftRequestSchema.parse(draftRequest)).toEqual(draftRequest);
  });

  it("rejects narrative content and duplicate fact references", () => {
    expect(
      reportDraftRequestSchema.safeParse({
        ...draftRequest,
        confirmedFactIds: [confirmedFactId, confirmedFactId],
      }).success,
    ).toBe(false);
    expect(
      reportDraftRequestSchema.safeParse({
        ...draftRequest,
        narrative: "Unreviewed content must not enter through this request.",
      }).success,
    ).toBe(false);
  });

  it("rejects report types outside the approved report package", () => {
    expect(
      reportDraftRequestSchema.safeParse({
        ...draftRequest,
        reportType: "invented_report_type",
      }).success,
    ).toBe(false);
  });
});
