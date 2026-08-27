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
  reportingStaffMemberId: "55555555-5555-4555-8555-555555555555",
  reportType: "cover_letter",
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

  it("accepts operational identifiers only when the paragraph cites their confirmed fact", () => {
    const operationalSource: ReportDraftSource = {
      ...source,
      confirmedFacts: [
        {
          id: factOne,
          field: "Confirmed event details",
          value: "ADC# 123456 at 9:50 pm on 8/27/2026",
          sourceNoteIds: [],
        },
      ],
    };
    const candidate = {
      paragraphs: [
        {
          text: "Inmate Example ADC# 123456 was present at 9:50 pm on 8/27/2026.",
          sourceFactIds: [factOne],
        },
      ],
    };

    expect(validateGeneratedReportDraft(candidate, operationalSource)).toEqual(
      candidate,
    );
  });

  it.each([
    ["Inmate Example ADC# 654321 was present.", "RW-030"],
    ["The event occurred at 10:15 pm.", "RW-030"],
    ["The event occurred on 8/28/2026.", "RW-030"],
    ["Inmate Example ADC#123456 was present.", "RW-002"],
    ["Sgt Example reviewed the draft.", "RW-003"],
    ["The event occurred at 9:50 PM.", "RW-005"],
    ["End of report.", "RW-014"],
    ["The inmate had a laceration.", "RW-031"],
    ["Review [NEEDED: location].", "RW-033"],
  ])("rejects legacy blocking rule violations: %s", (text, ruleId) => {
    expect(() =>
      validateGeneratedReportDraft(
        { paragraphs: [{ text, sourceFactIds: [factOne] }] },
        source,
      ),
    ).toThrow(ruleId);
  });

  it("requires cited support from the same paragraph, not an unrelated confirmed fact", () => {
    const candidate = {
      paragraphs: [
        {
          text: "The event occurred at 9:50 pm.",
          sourceFactIds: [factOne],
        },
      ],
    };
    const operationalSource: ReportDraftSource = {
      ...source,
      confirmedFacts: [
        source.confirmedFacts[0],
        { ...source.confirmedFacts[1], value: "9:50 pm" },
      ],
    };

    expect(() =>
      validateGeneratedReportDraft(candidate, operationalSource),
    ).toThrow("RW-030");
  });

  it("keeps supervisor summaries in third person and disciplinary closings explicit", () => {
    expect(() =>
      validateGeneratedReportDraft(
        { paragraphs: [{ text: "I reviewed it.", sourceFactIds: [factOne] }] },
        { ...source, reportType: "supervisor_summary" },
      ),
    ).toThrow("RW-035");
    expect(() =>
      validateGeneratedReportDraft(
        {
          paragraphs: [
            {
              text: "The fictional conduct was reviewed.",
              sourceFactIds: [factOne],
            },
          ],
        },
        { ...source, reportType: "disciplinary" },
      ),
    ).toThrow("RW-013");
  });

  it("requires a first-person report to use first-person perspective", () => {
    expect(() =>
      validateGeneratedReportDraft(
        {
          paragraphs: [
            {
              text: "The reporting officer reviewed the event.",
              sourceFactIds: [factOne],
            },
          ],
        },
        { ...source, reportType: "first_person" },
      ),
    ).toThrow("RW-034");

    expect(() =>
      validateGeneratedReportDraft(
        {
          paragraphs: [
            {
              text: 'The inmate stated, "I left."',
              sourceFactIds: [factOne],
            },
          ],
        },
        { ...source, reportType: "first_person" },
      ),
    ).toThrow("RW-034");

    const candidate = {
      paragraphs: [
        {
          text: "I reviewed the event.",
          sourceFactIds: [factOne],
        },
      ],
    };
    expect(
      validateGeneratedReportDraft(candidate, {
        ...source,
        reportType: "first_person",
      }),
    ).toEqual(candidate);
  });
});
