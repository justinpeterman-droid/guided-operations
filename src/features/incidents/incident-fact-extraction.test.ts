import { describe, expect, it } from "vitest";

import {
  IncidentFactExtractionError,
  buildIncidentFactExtractionRequest,
  validateIncidentFactExtraction,
} from "./incident-fact-extraction";

describe("incident fact extraction", () => {
  it("restores exact source text and permits multiple review facts per line", () => {
    const request = buildIncidentFactExtractionRequest(
      "Fictional officer observed two training events.",
    );
    expect(
      validateIncidentFactExtraction(
        {
          categoryKey: "incident_no_disciplinary",
          facts: [
            {
              sourceLineKey: "field-note-line-1",
              value: "The fictional officer observed the first training event.",
            },
            {
              sourceLineKey: "field-note-line-1",
              value:
                "The fictional officer observed the second training event.",
            },
          ],
        },
        request,
      ),
    ).toEqual({
      categoryKey: "incident_no_disciplinary",
      proposals: [
        {
          key: "field-note-line-1-fact-1",
          sourceText: "Fictional officer observed two training events.",
          value: "The fictional officer observed the first training event.",
        },
        {
          key: "field-note-line-1-fact-2",
          sourceText: "Fictional officer observed two training events.",
          value: "The fictional officer observed the second training event.",
        },
      ],
    });
  });

  it("rejects a provider-created source line or unknown category", () => {
    const request = buildIncidentFactExtractionRequest("Fictional source.");
    expect(() =>
      validateIncidentFactExtraction(
        {
          categoryKey: "invented_category",
          facts: [
            {
              sourceLineKey: "field-note-line-9",
              value: "Invented value.",
            },
          ],
        },
        request,
      ),
    ).toThrow(IncidentFactExtractionError);
  });
});
