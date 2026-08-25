import { describe, expect, it } from "vitest";

import {
  GeneratedReportDraftError,
  validateGeneratedReportDraft,
} from "./generated-report-draft";
import type { ReportDraftSource } from "./report-draft-source";

const factOne = "11111111-1111-4111-8111-111111111111";
const factTwo = "22222222-2222-4222-8222-222222222222";
const source: ReportDraftSource = {
  incidentId: "33333333-3333-4333-8333-333333333333",
  sourceIncidentRevisionId: "44444444-4444-4444-8444-444444444444",
  reportType: "incident-report",
  confirmedFacts: [
    {
      id: factOne,
      field: "location",
      value: "fixture location",
      sourceNoteIds: [],
    },
    { id: factTwo, field: "time", value: "fixture time", sourceNoteIds: [] },
  ],
};

describe("validateGeneratedReportDraft", () => {
  it("accepts a bounded candidate that cites only confirmed source facts", () => {
    const candidate = {
      paragraphs: [
        { text: "Draft wording for officer review.", sourceFactIds: [factOne] },
        { text: "A second draft paragraph.", sourceFactIds: [factTwo] },
      ],
    };

    expect(validateGeneratedReportDraft(candidate, source)).toEqual(candidate);
  });

  it("rejects a candidate that claims an unconfirmed fact", () => {
    expect(() =>
      validateGeneratedReportDraft(
        {
          paragraphs: [
            {
              text: "Unsupported statement.",
              sourceFactIds: ["55555555-5555-4555-8555-555555555555"],
            },
          ],
        },
        source,
      ),
    ).toThrow(GeneratedReportDraftError);
  });

  it("rejects repeated fact references inside one paragraph", () => {
    expect(() =>
      validateGeneratedReportDraft(
        {
          paragraphs: [
            { text: "Repeated source.", sourceFactIds: [factOne, factOne] },
          ],
        },
        source,
      ),
    ).toThrow("repeats a source fact reference");
  });
});
