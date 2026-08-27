import { describe, expect, it } from "vitest";

import {
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

const facts: ReviewedFact[] = [
  {
    id: confirmedFactId,
    field: "Location",
    state: "confirmed",
    value: "Fictional training room",
    sourceNoteIds: ["44444444-4444-4444-8444-444444444444"],
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
  reportType: "cover_letter",
  confirmedFactIds: [confirmedFactId],
};

describe("buildReportDraftSource", () => {
  it("passes through only explicitly confirmed fact values and provenance", () => {
    expect(buildReportDraftSource(request, revisionId, facts)).toEqual({
      incidentId: request.incidentId,
      sourceIncidentRevisionId: revisionId,
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
});
