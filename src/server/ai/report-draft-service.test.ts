import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { createReportDraftService } from "./report-draft-service";
import { AiBudgetCircuitOpenError } from "./ai-request-budget";
import type { ReportDraftSource } from "@/features/incidents/report-draft-source";

const source: ReportDraftSource = {
  incidentId: "11111111-1111-4111-8111-111111111111",
  sourceIncidentRevisionId: "22222222-2222-4222-8222-222222222222",
  reportType: "cover_letter",
  confirmedFacts: [
    {
      id: "33333333-3333-4333-8333-333333333333",
      field: "Location",
      value: "Fictional training room",
      sourceNoteIds: ["44444444-4444-4444-8444-444444444444"],
    },
  ],
};

describe("createReportDraftService", () => {
  it("supplies only the confirmed-fact source and accepts cited review-only prose", async () => {
    const generate = vi.fn().mockResolvedValue({
      paragraphs: [
        {
          text: "Fictional draft for officer review.",
          sourceFactIds: [source.confirmedFacts[0].id],
        },
      ],
    });
    const service = createReportDraftService(
      { providerKey: "fixture", generate },
      { maximumParagraphs: 8, maximumParagraphCharacters: 1_000 },
    );
    await expect(service.draft(source)).resolves.toMatchObject({
      kind: "draft",
    });
    expect(generate).toHaveBeenCalledWith(expect.objectContaining({ source }));
  });

  it("rejects a paragraph that cites an unconfirmed fact", async () => {
    const service = createReportDraftService(
      {
        providerKey: "fixture",
        generate: vi.fn().mockResolvedValue({
          paragraphs: [
            {
              text: "Unsupported.",
              sourceFactIds: ["55555555-5555-4555-8555-555555555555"],
            },
          ],
        }),
      },
      { maximumParagraphs: 8, maximumParagraphCharacters: 1_000 },
    );
    await expect(service.draft(source)).resolves.toEqual({
      kind: "invalid_output",
    });
  });

  it("preserves only the bounded budget reason for an honest degraded state", async () => {
    const service = createReportDraftService(
      {
        providerKey: "fixture",
        generate: vi
          .fn()
          .mockRejectedValue(new AiBudgetCircuitOpenError("budget_exhausted")),
      },
      { maximumParagraphs: 8, maximumParagraphCharacters: 1_000 },
    );

    await expect(service.draft(source)).resolves.toEqual({
      kind: "provider_unavailable",
      reasonCode: "budget_exhausted",
    });
  });
});
