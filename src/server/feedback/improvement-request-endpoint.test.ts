import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const validCsrf = vi.hoisted(() => vi.fn(() => true));
vi.mock("@/server/security/session-csrf", () => ({
  hasValidSessionCsrfRequest: validCsrf,
}));

import {
  MAX_FORM_CANDIDATE_BYTES,
  validateImprovementRequest,
} from "./improvement-request-endpoint";

const ORIGIN = "https://guided-operations.example.test";
const SESSION = "11111111-1111-4111-8111-111111111111";
const KEY = "k".repeat(32);

const pageFeedback = {
  requestNonce: "22222222-2222-4222-8222-222222222222",
  requestKind: "page_feedback",
  category: "confusing",
  description: "Make this action easier to understand.",
  routePath: "/forms",
  target: {
    id: "forms-library-request",
    role: "button",
    label: "Request a form",
  },
  viewport: { width: 390, height: 844 },
};

function request(
  body: unknown,
  overrides: Record<string, string> = {},
): Request {
  return new Request(ORIGIN + "/api/web/v1/improvement-requests", {
    method: "POST",
    headers: {
      origin: ORIGIN,
      "content-type": "application/json",
      ...overrides,
    },
    body: JSON.stringify(body),
  });
}

describe("improvement request validation", () => {
  it("accepts selected page feedback", async () => {
    const result = await validateImprovementRequest(
      request(pageFeedback),
      ORIGIN,
      SESSION,
      KEY,
    );
    expect(result).toMatchObject({ ok: true });
  });

  it("accepts a blank form candidate with a bounded digest", async () => {
    const result = await validateImprovementRequest(
      request({
        requestNonce: "33333333-3333-4333-8333-333333333333",
        requestKind: "form_candidate",
        category: "fillable_form",
        description:
          "This blank form should be reviewed for a browser workflow.",
        form: {
          title: "Fictional count supplement",
          requestedUse: "browser_fillable",
        },
        file: {
          name: "fictional-count-supplement.pdf",
          mediaType: "application/pdf",
          byteSize: MAX_FORM_CANDIDATE_BYTES,
          sha256: "a".repeat(64),
        },
      }),
      ORIGIN,
      SESSION,
      KEY,
    );
    expect(result).toMatchObject({ ok: true });
  });

  it("rejects a file on a non-upload form request", async () => {
    const result = await validateImprovementRequest(
      request({
        ...pageFeedback,
        requestKind: "form_request",
        category: "missing_form",
        form: { title: "Fictional form", requestedUse: "view_only" },
        target: undefined,
        file: {
          name: "not-allowed.pdf",
          mediaType: "application/pdf",
          byteSize: 123,
          sha256: "b".repeat(64),
        },
      }),
      ORIGIN,
      SESSION,
      KEY,
    );
    expect(result).toMatchObject({ ok: false, status: 400 });
  });

  it("rejects cross-origin, CSRF, and unknown-field requests", async () => {
    await expect(
      validateImprovementRequest(
        request(pageFeedback, { origin: "https://elsewhere.example" }),
        ORIGIN,
        SESSION,
        KEY,
      ),
    ).resolves.toMatchObject({ ok: false, code: "invalid_origin" });

    validCsrf.mockReturnValueOnce(false);
    await expect(
      validateImprovementRequest(request(pageFeedback), ORIGIN, SESSION, KEY),
    ).resolves.toMatchObject({ ok: false, code: "csrf_failed" });

    await expect(
      validateImprovementRequest(
        request({ ...pageFeedback, internalHtml: "<sensitive>" }),
        ORIGIN,
        SESSION,
        KEY,
      ),
    ).resolves.toMatchObject({ ok: false, status: 400 });
  });
});
