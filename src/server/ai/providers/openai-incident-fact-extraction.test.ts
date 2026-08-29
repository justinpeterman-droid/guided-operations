import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { buildIncidentFactExtractionRequest } from "@/features/incidents/incident-fact-extraction";

import { createOpenAiIncidentFactExtractionProvider } from "./openai-incident-fact-extraction";

const environment = {
  OPENAI_API_KEY: "x".repeat(20),
  OPENAI_REPORT_DRAFT_MODEL: "fictional-report-model",
  OPENAI_DATA_CONTROLS_APPROVAL_REF: "fictional-owner-approval",
  OPENAI_DATA_RETENTION_MODE: "zero_data_retention",
  OPENAI_API_DATA_SHARING_ENABLED: "false",
};

describe("OpenAI incident fact extraction provider", () => {
  it("uses strict, non-stored, tool-free structured output", async () => {
    const release = vi.fn().mockResolvedValue(undefined);
    const fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          status: "completed",
          output_text: JSON.stringify({
            categoryKey: "incident_no_disciplinary",
            facts: [
              {
                sourceLineKey: "field-note-line-1",
                value: "Fictional suggested fact.",
              },
            ],
          }),
        }),
        { status: 200 },
      ),
    );
    const provider = createOpenAiIncidentFactExtractionProvider({
      fetch: fetch as typeof globalThis.fetch,
      environment,
      budgetGuard: {
        reserve: vi.fn().mockResolvedValue({
          release,
          providerTimeoutMs: 85_000,
        }),
      },
    });
    const request = buildIncidentFactExtractionRequest("Fictional note.");

    await expect(provider.generate(request)).resolves.toMatchObject({
      categoryKey: "incident_no_disciplinary",
    });
    const [, init] = fetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body).toMatchObject({
      model: environment.OPENAI_REPORT_DRAFT_MODEL,
      store: false,
      text: { format: { type: "json_schema", strict: true } },
    });
    expect(body.instructions).toContain("never confirmed automatically");
    expect(body.tools).toBeUndefined();
    expect(release).toHaveBeenCalledOnce();
  });

  it("does not expose a provider response body on failure", async () => {
    const provider = createOpenAiIncidentFactExtractionProvider({
      fetch: vi
        .fn()
        .mockResolvedValue(
          new Response("restricted provider detail", { status: 429 }),
        ),
      environment,
      budgetGuard: {
        reserve: vi.fn().mockResolvedValue({
          release: vi.fn().mockResolvedValue(undefined),
          providerTimeoutMs: 85_000,
        }),
      },
    });
    await expect(
      provider.generate(buildIncidentFactExtractionRequest("Fictional note.")),
    ).rejects.toThrow("OpenAI incident extraction unavailable");
  });
});
