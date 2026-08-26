import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  disabledSignInEndpoint,
  handleSignInEndpoint,
} from "./sign-in-endpoint";

const origin = "https://preview.guided-operations.example";
const subjects = {
  deviceDigest: "a".repeat(64),
  networkDigest: "b".repeat(64),
  globalDigest: "c".repeat(64),
  deviceCookieValue: "d".repeat(43),
};

function request(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request(`${origin}/api/auth/sign-in`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin,
      "sec-fetch-site": "same-origin",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

describe("handleSignInEndpoint", () => {
  it("is unavailable while sign-in is disabled", async () => {
    const result = disabledSignInEndpoint();

    expect(result.response.status).toBe(404);
    expect(result.response.headers.get("cache-control")).toBe("no-store");
  });

  it("does not call authentication for cross-site or malformed input", async () => {
    const authenticate = vi.fn();
    const crossSite = request(
      { employeeNumber: "EMP-42", passcode: "Cedar7!9" },
      { "sec-fetch-site": "cross-site" },
    );

    await expect(
      handleSignInEndpoint(crossSite, origin, subjects, authenticate),
    ).resolves.toMatchObject({ response: expect.any(Response) });
    await expect(
      handleSignInEndpoint(
        request({ employeeNumber: "", passcode: "" }),
        origin,
        subjects,
        authenticate,
      ),
    ).resolves.toMatchObject({ response: expect.any(Response) });
    expect(authenticate).not.toHaveBeenCalled();
  });

  it("returns one generic failure for an unsuccessful credential check", async () => {
    const authenticate = vi.fn().mockResolvedValue({ status: "failed" });
    const result = await handleSignInEndpoint(
      request({ employeeNumber: "EMP-42", passcode: "Cedar7!9" }),
      origin,
      subjects,
      authenticate,
    );

    expect(result.response.status).toBe(401);
    await expect(result.response.json()).resolves.toEqual({
      message: "Unable to sign in with those credentials.",
    });
    expect(result.deviceCookieValue).toBe(subjects.deviceCookieValue);
  });

  it("passes only validated input and opaque subjects to authentication", async () => {
    const authenticate = vi.fn().mockResolvedValue({ status: "signed_in" });
    const result = await handleSignInEndpoint(
      request({ employeeNumber: " EMP-42 ", passcode: "Cedar7!9" }),
      origin,
      subjects,
      authenticate,
    );

    expect(authenticate).toHaveBeenCalledWith({
      employeeNumber: "EMP-42",
      passcode: "Cedar7!9",
      ...subjects,
    });
    expect(result.response.status).toBe(200);
    expect(result.response.headers.get("cache-control")).toBe("no-store");
    expect(result.deviceCookieValue).toBe(subjects.deviceCookieValue);
  });
});
