import { describe, expect, it } from "vitest";

import {
  buildReviewedFieldNoteFacts,
  proposeFactsFromFieldNotes,
} from "./field-note-fact-review";

describe("field note fact review", () => {
  it("proposes one unchanged fact per non-empty officer note line", () => {
    expect(
      proposeFactsFromFieldNotes(
        " Fictional first fact.\n\nFictional second fact. ",
      ),
    ).toEqual([
      {
        key: "field-note-line-1",
        sourceText: "Fictional first fact.",
        value: "Fictional first fact.",
      },
      {
        key: "field-note-line-2",
        sourceText: "Fictional second fact.",
        value: "Fictional second fact.",
      },
    ]);
  });

  it("keeps excluded lines out and records an officer edit as a new source note", () => {
    let id = 0;
    const result = buildReviewedFieldNoteFacts({
      reviews: [
        {
          key: "field-note-line-1",
          sourceText: "Fictional source wording.",
          value: "Fictional officer-confirmed wording.",
          decision: "confirmed",
        },
        {
          key: "field-note-line-2",
          sourceText: "Fictional excluded wording.",
          value: "Fictional excluded wording.",
          decision: "excluded",
        },
      ],
      sourceNoteId: "source-note",
      recordedAt: "2026-08-27T12:00:00.000Z",
      idFactory: () => `id-${++id}`,
      reportingStaffMemberIdsByProposalKey: {
        "field-note-line-1": ["fictional-officer"],
      },
    });

    expect(result.reviewNotes).toEqual([
      {
        id: "id-1",
        text: expect.stringContaining("Fictional officer-confirmed wording."),
        recordedAt: "2026-08-27T12:00:00.000Z",
      },
    ]);
    expect(result.reviewedFacts).toEqual([
      expect.objectContaining({
        id: "id-2",
        value: "Fictional officer-confirmed wording.",
        sourceNoteIds: ["id-1"],
        reportingStaffMemberIds: ["fictional-officer"],
      }),
    ]);
  });

  it("refuses a confirmed fact without an officer scope", () => {
    expect(() =>
      buildReviewedFieldNoteFacts({
        reviews: [
          {
            key: "field-note-line-1",
            sourceText: "Fictional fact.",
            value: "Fictional fact.",
            decision: "confirmed",
          },
        ],
        sourceNoteId: "source-note",
        recordedAt: "2026-08-27T12:00:00.000Z",
        idFactory: () => "unused",
        reportingStaffMemberIdsByProposalKey: {},
      }),
    ).toThrow("requires a reporting officer scope");
  });
});
