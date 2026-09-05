import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { isTrustedMutationRequest } from "./request-origin";

const applicationOrigin = "https://preview.guided-operations.example";

describe("isTrustedMutationRequest", () => {
  it("accepts an exact same-origin mutation", () => {
    const request = new Request(`${applicationOrigin}/api/incidents`, {
      headers: {
        origin: applicationOrigin,
        "sec-fetch-site": "same-origin",
      },
    });

    expect(isTrustedMutationRequest(request, applicationOrigin)).toBe(true);
  });

  it("rejects missing and mismatched Origin headers", () => {
    expect(
      isTrustedMutationRequest(
        new Request(`${applicationOrigin}/api/incidents`),
        applicationOrigin,
      ),
    ).toBe(false);
    expect(
      isTrustedMutationRequest(
        new Request(`${applicationOrigin}/api/incidents`, {
          headers: { origin: "https://attacker.example" },
        }),
        applicationOrigin,
      ),
    ).toBe(false);
  });

  it("rejects a cross-site request even when a forged Origin matches", () => {
    const request = new Request(`${applicationOrigin}/api/incidents`, {
      headers: {
        origin: applicationOrigin,
        "sec-fetch-site": "cross-site",
      },
    });

    expect(isTrustedMutationRequest(request, applicationOrigin)).toBe(false);
  });

  it("accepts localhost Origin when APP_ORIGIN is the loopback IP on the same port", () => {
    const request = new Request("http://localhost:3000/api/auth/sign-in", {
      headers: {
        origin: "http://localhost:3000",
        "sec-fetch-site": "same-origin",
      },
    });

    expect(isTrustedMutationRequest(request, "http://127.0.0.1:3000")).toBe(
      true,
    );
  });

  it("rejects loopback Origin when the port differs from APP_ORIGIN", () => {
    const request = new Request("http://localhost:3001/api/auth/sign-in", {
      headers: {
        origin: "http://localhost:3001",
        "sec-fetch-site": "same-origin",
      },
    });

    expect(isTrustedMutationRequest(request, "http://127.0.0.1:3000")).toBe(
      false,
    );
  });
});
