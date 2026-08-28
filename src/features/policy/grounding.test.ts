import { describe, expect, it } from "vitest";

import {
  GroundedPolicyAnswerError,
  groundedPolicyAnswerSchema,
  validateGroundedPolicyAnswer,
} from "./grounding";

const citation = {
  documentId: "11111111-1111-4111-8111-111111111111",
  documentVersionId: "22222222-2222-4222-8222-222222222222",
  chunkId: "33333333-3333-4333-8333-333333333333",
  stableKey: "fictional-policy-101",
  title: "Fictional Training Policy 101",
  versionLabel: "training-v1",
  sourceSha256: "a".repeat(64),
  collection: "BMU policies" as const,
  pageStart: 4,
  pageEnd: 5,
  sectionPath: "Fictional procedure",
  excerpt: "Fictional policy passage used only for an automated test.",
};

describe("grounded policy answer contract", () => {
  it("accepts an answered response with bounded source provenance", () => {
    const parsed = groundedPolicyAnswerSchema.parse({
      status: "answered",
      answer: "The fictional procedure requires a documented review.",
      citations: [citation],
      limitations: [],
    });

    expect(parsed.citations[0].sourceSha256).toHaveLength(64);
  });

  it("rejects authoritative answers without citations", () => {
    expect(() =>
      groundedPolicyAnswerSchema.parse({
        status: "answered",
        answer: "An unsupported answer.",
        citations: [],
        limitations: [],
      }),
    ).toThrow(/requires at least one citation/i);
  });

  it("requires limitations when evidence is insufficient", () => {
    expect(() =>
      groundedPolicyAnswerSchema.parse({
        status: "insufficient_evidence",
        answer: "The approved sources do not establish an answer.",
        citations: [],
        limitations: [],
      }),
    ).toThrow(/explain its limitation/i);
  });

  it("rejects reversed page ranges", () => {
    expect(() =>
      groundedPolicyAnswerSchema.parse({
        status: "answered",
        answer: "The fictional procedure requires a documented review.",
        citations: [{ ...citation, pageStart: 8, pageEnd: 3 }],
        limitations: [],
      }),
    ).toThrow(/cannot precede/i);
  });

  it("accepts an answer whose citation exactly matches retrieved evidence", () => {
    const answer = {
      status: "answered",
      answer: "The fictional procedure requires a documented review.",
      citations: [citation],
      limitations: [],
    };

    expect(validateGroundedPolicyAnswer(answer, [citation])).toEqual(answer);
  });

  it("rejects invented citations and altered retrieved provenance", () => {
    const answer = {
      status: "answered",
      answer: "The fictional procedure requires a documented review.",
      citations: [citation],
      limitations: [],
    };

    expect(() =>
      validateGroundedPolicyAnswer(
        {
          ...answer,
          citations: [
            { ...citation, chunkId: "44444444-4444-4444-8444-444444444444" },
          ],
        },
        [citation],
      ),
    ).toThrow(GroundedPolicyAnswerError);
    expect(() =>
      validateGroundedPolicyAnswer(
        { ...answer, citations: [{ ...citation, pageEnd: 6 }] },
        [citation],
      ),
    ).toThrow(/altered the provenance/i);
  });
});
