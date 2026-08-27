import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { createOpenAiReportDraftGenerationProvider } from "./openai-report-draft-generation";
import { REPORT_WRITING_RULE_PROFILE } from "@/features/incidents/report-writing-rules";

const environment = {
  OPENAI_API_KEY: "x".repeat(20),
  OPENAI_REPORT_DRAFT_MODEL: "fictional-report-model",
};
const release = vi.fn().mockResolvedValue(undefined);
const budgetGuard = {
  reserve: vi.fn().mockResolvedValue({ release, providerTimeoutMs: 85_000 }),
};
const request = {
  source: {
    incidentId: "11111111-1111-4111-8111-111111111111",
    sourceIncidentRevisionId: "22222222-2222-4222-8222-222222222222",
    reportType: "incident_report",
    confirmedFacts: [
      {
        id: "33333333-3333-4333-8333-333333333333",
        field: "Location",
        value: "Fictional training room",
        sourceNoteIds: ["44444444-4444-4444-8444-444444444444"],
      },
    ],
  },
  maximumParagraphs: 8,
  maximumParagraphCharacters: 1000,
};

describe("OpenAI report draft generation provider", () => {
  it("uses a non-stored, tool-free strict structured request with a dedicated model", async () => {
    const fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          status: "completed",
          output_text: JSON.stringify({
            paragraphs: [
              {
                text: "Fictional draft.",
                sourceFactIds: [request.source.confirmedFacts[0].id],
              },
            ],
          }),
        }),
        { status: 200 },
      ),
    );
    const provider = createOpenAiReportDraftGenerationProvider({
      fetch: fetch as typeof globalThis.fetch,
      environment,
      budgetGuard,
    });
    await expect(provider.generate(request)).resolves.toMatchObject({
      paragraphs: [{ text: "Fictional draft." }],
    });
    const [, init] = fetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body).toMatchObject({
      model: environment.OPENAI_REPORT_DRAFT_MODEL,
      store: false,
      text: { format: { type: "json_schema", strict: true } },
    });
    expect(body.instructions).toContain("ADC# 123456");
    expect(JSON.parse(body.input)).toMatchObject({
      ruleProfile: REPORT_WRITING_RULE_PROFILE,
      reportType: request.source.reportType,
    });
    expect(provider.providerKey).toBe("openai-responses-report-draft-v2");
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(release).toHaveBeenCalled();
  });

  it("redacts provider response bodies on failure", async () => {
    const provider = createOpenAiReportDraftGenerationProvider({
      fetch: vi
        .fn()
        .mockResolvedValue(
          new Response("private provider detail", { status: 429 }),
        ),
      environment,
      budgetGuard,
    });
    await expect(provider.generate(request)).rejects.toThrow(
      "OpenAI report draft generation unavailable",
    );
  });

  it("does not contact OpenAI when the shared budget denies the request", async () => {
    const fetch = vi.fn();
    const provider = createOpenAiReportDraftGenerationProvider({
      fetch,
      environment,
      budgetGuard: {
        reserve: vi.fn().mockRejectedValue(new Error("circuit open")),
      },
    });

    await expect(provider.generate(request)).rejects.toThrow("circuit open");
    expect(fetch).not.toHaveBeenCalled();
  });
});
