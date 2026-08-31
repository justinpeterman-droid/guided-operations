import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const validCsrf = vi.hoisted(() => vi.fn(() => true));
vi.mock("@/server/security/session-csrf", () => ({
  hasValidSessionCsrfRequest: validCsrf,
}));

import {
  MAX_ANSWER_REPORT_CITATION_BYTES,
  validateAnswerReportRequest,
} from "./answer-report-endpoint";

const ORIGIN = "https://guided-operations.example";
const SESSION = "11111111-1111-4111-8111-111111111111";
const KEY = "k".repeat(32);

function makeRequest(
  body: unknown,
  overrides: Record<string, string> = {},
): Request {
  return new Request(ORIGIN + "/api/web/v1/answer-reports", {
    method: "POST",
    headers: {
      origin: ORIGIN,
      "content-type": "application/json",
      ...overrides,
    },
    body: JSON.stringify(body),
  });
}

const goodCitation = {
  documentId: "11111111-1111-4111-8111-111111111111",
  documentVersionId: "22222222-2222-4222-8222-222222222222",
  chunkId: "33333333-3333-4333-8333-333333333333",
  stableKey: "count-principles-and-procedures",
  title: "Count Principles and Procedures",
  versionLabel: "2026 revision",
  sourceSha256: "a".repeat(64),
  collection: "BMU policies" as const,
  pageStart: 4,
  pageEnd: 4,
  sectionPath: "Trustee supervision",
  excerpt: "Trustees working outside the fence are verified once every hour.",
};

const goodBody = {
  question: "How often do I verify a trustee working outside the fence?",
  answerText: "At a minimum of once every hour.",
  citations: [goodCitation],
};

describe("answer report request validation", () => {
  it("accepts a well-formed report", async () => {
    validCsrf.mockReturnValue(true);
    const result = await validateAnswerReportRequest(
      makeRequest(goodBody),
      ORIGIN,
      SESSION,
      KEY,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.answerText).toBe("At a minimum of once every hour.");
      expect(result.citations).toHaveLength(1);
    }
  });

  it("accepts a report with no citations, because an uncited answer is exactly what needs reporting", async () => {
    validCsrf.mockReturnValue(true);
    const result = await validateAnswerReportRequest(
      makeRequest({ ...goodBody, citations: [] }),
      ORIGIN,
      SESSION,
      KEY,
    );
    expect(result.ok).toBe(true);
  });

  it("rejects a cross-origin report", async () => {
    validCsrf.mockReturnValue(true);
    const result = await validateAnswerReportRequest(
      makeRequest(goodBody, { origin: "https://elsewhere.example" }),
      ORIGIN,
      SESSION,
      KEY,
    );
    expect(result).toMatchObject({
      ok: false,
      status: 403,
      code: "invalid_origin",
    });
  });

  it("rejects a report without a valid session CSRF token", async () => {
    validCsrf.mockReturnValue(false);
    const result = await validateAnswerReportRequest(
      makeRequest(goodBody),
      ORIGIN,
      SESSION,
      KEY,
    );
    expect(result).toMatchObject({
      ok: false,
      status: 403,
      code: "csrf_failed",
    });
  });

  it("rejects a non-JSON content type", async () => {
    validCsrf.mockReturnValue(true);
    const result = await validateAnswerReportRequest(
      makeRequest(goodBody, { "content-type": "text/plain" }),
      ORIGIN,
      SESSION,
      KEY,
    );
    expect(result).toMatchObject({ ok: false, status: 415 });
  });

  it("rejects an empty answer", async () => {
    validCsrf.mockReturnValue(true);
    const result = await validateAnswerReportRequest(
      makeRequest({ ...goodBody, answerText: "" }),
      ORIGIN,
      SESSION,
      KEY,
    );
    expect(result).toMatchObject({ ok: false, status: 400 });
  });

  it("rejects unknown top-level fields rather than silently storing them", async () => {
    validCsrf.mockReturnValue(true);
    const result = await validateAnswerReportRequest(
      makeRequest({ ...goodBody, officerName: "Smith" }),
      ORIGIN,
      SESSION,
      KEY,
    );
    expect(result).toMatchObject({ ok: false, status: 400 });
  });

  it("rejects unknown citation fields instead of persisting arbitrary JSON", async () => {
    validCsrf.mockReturnValue(true);
    const result = await validateAnswerReportRequest(
      makeRequest({
        ...goodBody,
        citations: [{ ...goodCitation, internalNote: "not allowed" }],
      }),
      ORIGIN,
      SESSION,
      KEY,
    );
    expect(result).toMatchObject({ ok: false, status: 400 });
  });

  it("rejects deeply nested citation data hidden in an unknown field", async () => {
    validCsrf.mockReturnValue(true);
    const result = await validateAnswerReportRequest(
      makeRequest({
        ...goodBody,
        citations: [
          {
            ...goodCitation,
            metadata: { nested: { payload: { value: "not allowed" } } },
          },
        ],
      }),
      ORIGIN,
      SESSION,
      KEY,
    );
    expect(result).toMatchObject({ ok: false, status: 400 });
  });

  it("bounds every citation excerpt", async () => {
    validCsrf.mockReturnValue(true);
    const result = await validateAnswerReportRequest(
      makeRequest({
        ...goodBody,
        citations: [{ ...goodCitation, excerpt: "x".repeat(1_201) }],
      }),
      ORIGIN,
      SESSION,
      KEY,
    );
    expect(result).toMatchObject({ ok: false, status: 400 });
  });

  it("bounds the aggregate serialized citation payload", async () => {
    validCsrf.mockReturnValue(true);
    const largeCitation = {
      ...goodCitation,
      stableKey: "s".repeat(128),
      title: "t".repeat(300),
      versionLabel: "v".repeat(120),
      sectionPath: "p".repeat(300),
      excerpt: "e".repeat(1_200),
    };
    const citations = Array.from({ length: 20 }, () => largeCitation);
    expect(new TextEncoder().encode(JSON.stringify(citations)).byteLength).toBeGreaterThan(
      MAX_ANSWER_REPORT_CITATION_BYTES,
    );

    const result = await validateAnswerReportRequest(
      makeRequest({ ...goodBody, citations }),
      ORIGIN,
      SESSION,
      KEY,
    );
    expect(result).toMatchObject({ ok: false, status: 400 });
  });

  it("bounds an oversized answer instead of storing it", async () => {
    validCsrf.mockReturnValue(true);
    const result = await validateAnswerReportRequest(
      makeRequest({ ...goodBody, answerText: "x".repeat(20_001) }),
      ORIGIN,
      SESSION,
      KEY,
    );
    expect(result).toMatchObject({ ok: false, status: 400 });
  });

  it("bounds the number of citations", async () => {
    validCsrf.mockReturnValue(true);
    const result = await validateAnswerReportRequest(
      makeRequest({
        ...goodBody,
        citations: Array.from({ length: 21 }, () => goodCitation),
      }),
      ORIGIN,
      SESSION,
      KEY,
    );
    expect(result).toMatchObject({ ok: false, status: 400 });
  });

  it("rejects a malformed body", async () => {
    validCsrf.mockReturnValue(true);
    const request = new Request(ORIGIN + "/api/web/v1/answer-reports", {
      method: "POST",
      headers: { origin: ORIGIN, "content-type": "application/json" },
      body: "{not json",
    });
    const result = await validateAnswerReportRequest(
      request,
      ORIGIN,
      SESSION,
      KEY,
    );
    expect(result).toMatchObject({ ok: false, status: 400 });
  });
});
