import { describe, expect, it } from "vitest";

import {
  buildReportDraftGenerationSource,
  buildReportDraftSource,
  ReportDraftSourceError,
} from "./report-draft-source";
import {
  INCIDENT_SCHEMA_VERSION,
  type ReportDraftRequest,
  type ReviewedFact,
} from "./schema";

const revisionId = "11111111-1111-4111-8111-111111111111";
const confirmedFactId = "22222222-2222-4222-8222-222222222222";
const unknownFactId = "33333333-3333-4333-8333-333333333333";
const reportingStaffMemberId = "66666666-6666-4666-8666-666666666666";

const facts: ReviewedFact[] = [
  {
    id: confirmedFactId,
    field: "Location",
    state: "confirmed",
    value: "Fictional training room",
    sourceNoteIds: ["44444444-4444-4444-8444-444444444444"],
    reportingStaffMemberIds: [reportingStaffMemberId],
  },
  {
    id: unknownFactId,
    field: "Witness statement",
    state: "unknown",
    reason: "No fictional witness was included.",
  },
];

const request: ReportDraftRequest = {
  schemaVersion: INCIDENT_SCHEMA_VERSION,
  incidentId: "55555555-5555-4555-8555-555555555555",
  sourceIncidentRevisionId: revisionId,
  reportingStaffMemberId,
  reportType: "cover_letter",
  confirmedFactIds: [confirmedFactId],
};

describe("buildReportDraftSource", () => {
  it("passes through only explicitly confirmed fact values and provenance", () => {
    expect(buildReportDraftSource(request, revisionId, facts)).toEqual({
      incidentId: request.incidentId,
      sourceIncidentRevisionId: revisionId,
      reportingStaffMemberId: request.reportingStaffMemberId,
      reportType: "cover_letter",
      confirmedFacts: [
        {
          id: confirmedFactId,
          field: "Location",
          value: "Fictional training room",
          sourceNoteIds: ["44444444-4444-4444-8444-444444444444"],
        },
      ],
    });
  });

  it("rejects unknown and absent facts instead of silently drafting from them", () => {
    expect(() =>
      buildReportDraftSource(
        { ...request, confirmedFactIds: [unknownFactId] },
        revisionId,
        facts,
      ),
    ).toThrow(ReportDraftSourceError);
    expect(() =>
      buildReportDraftSource(
        {
          ...request,
          confirmedFactIds: ["66666666-6666-4666-8666-666666666666"],
        },
        revisionId,
        facts,
      ),
    ).toThrow("only confirmed facts");
  });

  it("rejects facts from a different immutable revision", () => {
    expect(() =>
      buildReportDraftSource(
        request,
        "77777777-7777-4777-8777-777777777777",
        facts,
      ),
    ).toThrow("do not belong");
  });

  it("rejects a confirmed fact scoped only to another reporting officer", () => {
    const confirmedFact = facts[0];
    if (confirmedFact.state !== "confirmed") {
      throw new Error("Test fixture must begin with a confirmed fact.");
    }
    expect(() =>
      buildReportDraftSource(request, revisionId, [
        {
          ...confirmedFact,
          reportingStaffMemberIds: ["77777777-7777-4777-8777-777777777777"],
        },
        facts[1],
      ]),
    ).toThrow("scoped to its reporting officer");
  });
});

describe("buildReportDraftGenerationSource", () => {
  it("projects an exact UTC timestamp into report-safe prose without changing attribution", () => {
    const source = buildReportDraftSource(request, revisionId, [
      {
        id: confirmedFactId,
        state: "confirmed",
        field: "Incident date and time",
        value: "2026-09-01T18:51:00.000Z",
        sourceNoteIds: ["44444444-4444-4444-8444-444444444444"],
        reportingStaffMemberIds: [reportingStaffMemberId],
      },
      facts[1],
    ]);

    expect(buildReportDraftGenerationSource(source)).toEqual({
      incidentId: request.incidentId,
      sourceIncidentRevisionId: revisionId,
      reportType: "cover_letter",
      confirmedFacts: [
        expect.objectContaining({
          id: confirmedFactId,
          value: "2026-09-01 at 6:51 pm UTC",
        }),
      ],
    });
    expect(source.confirmedFacts[0].value).toBe("2026-09-01T18:51:00.000Z");
  });

  it("preserves ordinary confirmed fact text exactly", () => {
    const source = buildReportDraftSource(request, revisionId, facts);

    expect(
      buildReportDraftGenerationSource(source).confirmedFacts[0].value,
    ).toBe("Fictional training room");
  });
});
