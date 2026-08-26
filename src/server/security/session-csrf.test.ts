import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  CSRF_DIGEST_COOKIE,
  CSRF_HEADER,
  CSRF_TOKEN_COOKIE,
  hasValidSessionCsrfRequest,
  issueSessionCsrfToken,
} from "./session-csrf";

const sessionId = "11111111-1111-4111-8111-111111111111";
const hmacKey = "k".repeat(32);

describe("session CSRF cookie contract", () => {
  it("validates the header token against the HTTP-only digest cookie", () => {
    const issued = issueSessionCsrfToken(sessionId, hmacKey);
    const headers = new Headers({
      [CSRF_HEADER]: issued.token,
      cookie: `${CSRF_TOKEN_COOKIE}=${issued.token}; ${CSRF_DIGEST_COOKIE}=${issued.digest}`,
    });

    expect(hasValidSessionCsrfRequest(headers, sessionId, hmacKey)).toBe(true);
    expect(
      hasValidSessionCsrfRequest(
        headers,
        "22222222-2222-4222-8222-222222222222",
        hmacKey,
      ),
    ).toBe(false);
  });

  it("rejects a missing header, digest, or copied browser token", () => {
    const issued = issueSessionCsrfToken(sessionId, hmacKey);

    expect(
      hasValidSessionCsrfRequest(
        new Headers({ cookie: `${CSRF_DIGEST_COOKIE}=${issued.digest}` }),
        sessionId,
        hmacKey,
      ),
    ).toBe(false);
    expect(
      hasValidSessionCsrfRequest(
        new Headers({ [CSRF_HEADER]: issued.token }),
        sessionId,
        hmacKey,
      ),
    ).toBe(false);
    expect(
      hasValidSessionCsrfRequest(
        new Headers({
          [CSRF_HEADER]: "copied-token",
          cookie: `${CSRF_DIGEST_COOKIE}=${issued.digest}`,
        }),
        sessionId,
        hmacKey,
      ),
    ).toBe(false);
  });
});
