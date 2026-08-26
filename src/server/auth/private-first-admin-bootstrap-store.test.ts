import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { createFirstAdminBootstrapStore } from "./private-first-admin-bootstrap-store";

describe("createFirstAdminBootstrapStore", () => {
  it("passes the narrow lifecycle calls through without a browser-facing client", async () => {
    const persistence = {
      stage: vi.fn().mockResolvedValue(undefined),
      activate: vi.fn().mockResolvedValue(undefined),
      abandon: vi.fn().mockResolvedValue(undefined),
    };
    const store = createFirstAdminBootstrapStore(persistence);
    const staged = {
      authUserId: "fixture-user",
      employeeLookupDigest: "a".repeat(64),
      employeeNumberHint: "01",
      displayName: "Fictional Administrator",
      signInAlias: "fixture@example.invalid",
      temporaryPasscodeExpiresAt: new Date("2026-08-26T12:30:00.000Z"),
    };

    await store.stage(staged);
    await store.activate("fixture-user");
    await store.abandon("fixture-user");

    expect(persistence.stage).toHaveBeenCalledWith(staged);
    expect(persistence.activate).toHaveBeenCalledWith("fixture-user");
    expect(persistence.abandon).toHaveBeenCalledWith("fixture-user");
  });
});
