import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("./safe-operational-event", () => ({
  writeSafeOperationalEvent: vi.fn(),
}));

import { createAdminStepUpObserver } from "./admin-step-up-observer";
import { writeSafeOperationalEvent } from "./safe-operational-event";

describe("administrator step-up observability", () => {
  it("preserves the proof response without sending its secrets to observability", async () => {
    const passcode = "AdministratorPasscodeFixtureOnly";
    const proofRequestId = "dddddddd-0000-4000-8000-000000000001";
    const proofToken = "x".repeat(43);
    const observe = createAdminStepUpObserver();
    const response = observe(
      Response.json({ data: { requestId: proofRequestId, token: proofToken } }),
      "issued",
      "production",
    );

    expect(response.headers.get("x-request-id")).toMatch(/^[0-9a-f-]{36}$/u);
    await expect(response.json()).resolves.toEqual({
      data: { requestId: proofRequestId, token: proofToken },
    });
    expect(writeSafeOperationalEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        event_name: "admin.step_up",
        outcome: "issued",
        request_id: response.headers.get("x-request-id"),
        status_code: 200,
        environment: "production",
      }),
    );
    const serializedEvent = JSON.stringify(
      vi.mocked(writeSafeOperationalEvent).mock.calls,
    );
    expect(serializedEvent).not.toContain(passcode);
    expect(serializedEvent).not.toContain(proofRequestId);
    expect(serializedEvent).not.toContain(proofToken);
  });
});
