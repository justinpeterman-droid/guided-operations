import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { bootstrapFirstAdministrator } from "./first-admin-bootstrap";

function setup() {
  const authUserProvisioner = {
    createPasswordUser: vi
      .fn()
      .mockResolvedValue({ authUserId: "fixture-user" }),
    deleteUser: vi.fn().mockResolvedValue(undefined),
  };
  const store = {
    stage: vi.fn().mockResolvedValue(undefined),
    activate: vi.fn().mockResolvedValue(undefined),
    abandon: vi.fn().mockResolvedValue(undefined),
  };
  const delivery = { deliver: vi.fn().mockResolvedValue(undefined) };
  return {
    authUserProvisioner,
    store,
    delivery,
    employeeLookupHmacKey: "x".repeat(32),
    now: () => new Date("2026-08-26T12:00:00.000Z"),
  };
}

describe("bootstrapFirstAdministrator", () => {
  it("delivers a generated credential without returning it and activates only after delivery", async () => {
    const dependencies = setup();

    await expect(
      bootstrapFirstAdministrator(
        {
          employeeNumber: "fixture-01",
          employeeNumberHint: "01",
          displayName: "Fictional Administrator",
        },
        dependencies,
      ),
    ).resolves.toEqual({ status: "activated" });

    const delivery = dependencies.delivery.deliver.mock.calls[0]?.[0];
    expect(delivery).toMatchObject({ employeeNumberHint: "01" });
    expect(delivery?.temporaryPasscode).toHaveLength(20);
    expect(dependencies.store.activate).toHaveBeenCalledWith("fixture-user");
    expect(
      dependencies.store.activate.mock.invocationCallOrder[0],
    ).toBeGreaterThan(
      dependencies.delivery.deliver.mock.invocationCallOrder[0] ?? 0,
    );
  });

  it("removes the pending identity when private delivery fails", async () => {
    const dependencies = setup();
    dependencies.delivery.deliver.mockRejectedValue(
      new Error("delivery failed"),
    );

    await expect(
      bootstrapFirstAdministrator(
        {
          employeeNumber: "fixture-02",
          employeeNumberHint: "02",
          displayName: "Fictional Administrator",
        },
        dependencies,
      ),
    ).resolves.toEqual({ status: "failed" });

    expect(dependencies.store.activate).not.toHaveBeenCalled();
    expect(dependencies.store.abandon).toHaveBeenCalledWith("fixture-user");
    expect(dependencies.authUserProvisioner.deleteUser).toHaveBeenCalledWith(
      "fixture-user",
    );
  });

  it("removes an orphaned Auth user when the zero-account database ceremony rejects it", async () => {
    const dependencies = setup();
    dependencies.store.stage.mockRejectedValue(
      new Error("already bootstrapped"),
    );

    await expect(
      bootstrapFirstAdministrator(
        {
          employeeNumber: "fixture-03",
          employeeNumberHint: "03",
          displayName: "Fictional Administrator",
        },
        dependencies,
      ),
    ).resolves.toEqual({ status: "failed" });

    expect(dependencies.delivery.deliver).not.toHaveBeenCalled();
    expect(dependencies.authUserProvisioner.deleteUser).toHaveBeenCalledWith(
      "fixture-user",
    );
  });
});
