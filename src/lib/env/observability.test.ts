import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { getObservabilityEnvironment } from "./observability";

describe("observability environment", () => {
  it("keeps safe operational logging disabled by default", () => {
    expect(getObservabilityEnvironment({})).toEqual({
      SAFE_OPERATIONAL_LOGGING_ENABLED: false,
    });
  });

  it("requires an exact boolean string", () => {
    expect(
      getObservabilityEnvironment({ SAFE_OPERATIONAL_LOGGING_ENABLED: "true" }),
    ).toEqual({ SAFE_OPERATIONAL_LOGGING_ENABLED: true });
    expect(() =>
      getObservabilityEnvironment({ SAFE_OPERATIONAL_LOGGING_ENABLED: "yes" }),
    ).toThrow();
  });
});
