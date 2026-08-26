import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { getIncidentServerEnvironment } from "./incident-server";

describe("getIncidentServerEnvironment", () => {
  it("requires a dedicated non-empty incident idempotency key", () => {
    expect(() => getIncidentServerEnvironment({})).toThrow();
    expect(() =>
      getIncidentServerEnvironment({ INCIDENT_IDEMPOTENCY_HMAC_KEY: "short" }),
    ).toThrow();
  });

  it("returns an adequate server-only key", () => {
    expect(
      getIncidentServerEnvironment({
        INCIDENT_IDEMPOTENCY_HMAC_KEY: "k".repeat(32),
      }),
    ).toEqual({ INCIDENT_IDEMPOTENCY_HMAC_KEY: "k".repeat(32) });
  });
});
