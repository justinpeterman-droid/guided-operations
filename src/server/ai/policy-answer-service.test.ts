import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import type { SourceCitation } from "@/features/policy/grounding";

import { AiBudgetCircuitOpenError } from "./ai-request-budget";
import { createPolicyAnswerService } from "./policy-answer-service";

const citation: SourceCitation = {
  documentId: "11111111-1111-4111-8111-111111111111",
  documentVersionId: "22222222-2222-4222-8222-222222222222",
  chunkId: "33333333-3333-4333-8333-333333333333",
  stableKey: "fictional-policy-101",
  title: "Fictional Training Policy 101",
  versionLabel: "training-v1",
  sourceSha256: "a".repeat(64),
  pageStart: 4,
  pageEnd: 5,
  sectionPath: "Fictional procedure",
  excerpt: "Fictional policy passage used only for an automated test.",
};

const request = {
  facilityId: "44444444-4444-4444-8444-444444444444",
  question: "What does the fictional procedure require?",
};

function createService(
  retrieve = vi.fn().mockResolvedValue([{ citation, relevanceScore: 0.9 }]),
  generate = vi.fn().mockResolvedValue({
    status: "answered",
    answer: "The fictional procedure requires a documented review.",
    citations: [citation],
    limitations: [],
  }),
) {
  return {
    service: createPolicyAnswerService(
      {
        retrieval: { providerKey: "fictional-retrieval", retrieve },
        generation: { providerKey: "fictional-generation", generate },
      },
      { maximumPassages: 8, maximumAnswerCharacters: 4_000 },
    ),
    retrieve,
    generate,
  };
}

describe("policy answer service", () => {
  it("generates only from retrieved citations and returns a validated answer", async () => {
    const { service, retrieve, generate } = createService();

    await expect(service.answer(request)).resolves.toMatchObject({
      kind: "answer",
      answer: { citations: [citation] },
    });
    expect(retrieve).toHaveBeenCalledWith({
      ...request,
      maximumPassages: 8,
      approvedDocumentVersionIds: undefined,
    });
    expect(generate).toHaveBeenCalledWith({
      question: request.question,
      passages: [{ citation, relevanceScore: 0.9 }],
      maximumAnswerCharacters: 4_000,
    });
  });

  it("does not call a model when retrieval has no authorized evidence", async () => {
    const { service, generate } = createService(vi.fn().mockResolvedValue([]));

    await expect(service.answer(request)).resolves.toMatchObject({
      kind: "insufficient_evidence",
      answer: { citations: [] },
    });
    expect(generate).not.toHaveBeenCalled();
  });

  it("fails closed when a provider alters a retrieved source label", async () => {
    const { service } = createService(
      undefined,
      vi.fn().mockResolvedValue({
        status: "answered",
        answer: "Unsupported alteration.",
        citations: [{ ...citation, title: "Invented title" }],
        limitations: [],
      }),
    );

    await expect(service.answer(request)).resolves.toEqual({
      kind: "provider_unavailable",
      reasonCode: "invalid_output",
    });
  });

  it("does not expose a provider error to the caller", async () => {
    const { service } = createService(
      vi.fn().mockRejectedValue(new Error("down")),
    );

    await expect(service.answer(request)).resolves.toEqual({
      kind: "provider_unavailable",
      reasonCode: "retrieval_failed",
    });
  });

  it("preserves only the bounded budget reason for an honest degraded state", async () => {
    const { service } = createService(
      undefined,
      vi
        .fn()
        .mockRejectedValue(new AiBudgetCircuitOpenError("budget_exhausted")),
    );

    await expect(service.answer(request)).resolves.toEqual({
      kind: "provider_unavailable",
      reasonCode: "budget_exhausted",
    });
  });
});
