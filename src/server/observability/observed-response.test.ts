import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("./safe-operational-event", () => ({
  writeSafeOperationalEvent: vi.fn(),
}));

import { writeSafeOperationalEvent } from "./safe-operational-event";
import {
  boundedOperationalDuration,
  observedResponse,
} from "./observed-response";

describe("observed response", () => {
  beforeEach(() => vi.clearAllMocks());

  it("adds only the opaque request correlation and writes the allowlisted event", () => {
    const event = {
      event_name: "auth.sign_out" as const,
      outcome: "signed_out" as const,
      request_id: "11111111-1111-4111-8111-111111111111",
      status_code: 200,
      duration_ms: 12,
      environment: "preview" as const,
    };
    const response = observedResponse(Response.json({ data: "ok" }), event);

    expect(response.headers.get("x-request-id")).toBe(event.request_id);
    expect(writeSafeOperationalEvent).toHaveBeenCalledWith(event);
  });

  it("bounds negative and excessive durations", () => {
    vi.spyOn(Date, "now").mockReturnValue(1_000);
    expect(boundedOperationalDuration(1_100)).toBe(0);
    expect(boundedOperationalDuration(-4_000_000)).toBe(3_600_000);
  });
});
