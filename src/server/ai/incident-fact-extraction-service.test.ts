import { describe, expect, it } from "vitest";

import { vi } from "vitest";

vi.mock("server-only", () => ({}));

import { AiBudgetCircuitOpenError } from "./ai-request-budget";
import { createIncidentFactExtractionService } from "./incident-fact-extraction-service";

describe("incident fact extraction service", () => {
  it("returns only validated review suggestions", async () => {
    const service = createIncidentFactExtractionService({
      providerKey: "fictional-provider",
      async generate() {
        return {
          categoryKey: "incident_no_disciplinary",
          facts: [
            {
              sourceLineKey: "field-note-line-1",
              value: "Fictional structured fact.",
            },
          ],
        };
      },
    });

    await expect(service.suggest("Fictional raw note.")).resolves.toMatchObject(
      {
        kind: "suggested",
        result: {
          proposals: [
            {
              sourceText: "Fictional raw note.",
              value: "Fictional structured fact.",
            },
          ],
        },
      },
    );
  });

  it("fails closed for fabricated provenance", async () => {
    const service = createIncidentFactExtractionService({
      providerKey: "fictional-provider",
      async generate() {
        return {
          categoryKey: "incident_no_disciplinary",
          facts: [{ sourceLineKey: "field-note-line-99", value: "Invented." }],
        };
      },
    });
    await expect(service.suggest("Fictional raw note.")).resolves.toEqual({
      kind: "invalid_output",
    });
  });

  it("keeps the manual workflow available when generation is disabled", async () => {
    const service = createIncidentFactExtractionService({
      providerKey: "fictional-provider",
      async generate() {
        throw new AiBudgetCircuitOpenError("generation_disabled");
      },
    });
    await expect(service.suggest("Fictional raw note.")).resolves.toEqual({
      kind: "provider_unavailable",
      reasonCode: "generation_disabled",
    });
  });
});
