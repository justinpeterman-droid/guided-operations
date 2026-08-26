import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { inviteAccount } from "./invite-account";

function setup() {
  const authorization = {
    consume: vi.fn().mockResolvedValue({ actorAuthUserId: "fixture-admin" }),
  };
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
    authorization,
    authUserProvisioner,
    store,
    delivery,
    employeeLookupHmacKey: "x".repeat(32),
    now: () => new Date("2026-08-26T12:00:00.000Z"),
  };
}

const input = {
  employeeNumber: "fixture-02",
  employeeNumberHint: "02",
  displayName: "Fictional Officer",
  role: "officer" as const,
};

describe("inviteAccount", () => {
  it("requires one-time administrator authorization before creating anything", async () => {
    const dependencies = setup();
    dependencies.authorization.consume.mockResolvedValue(null);

    await expect(inviteAccount(input, dependencies)).resolves.toEqual({
      status: "denied",
    });
    expect(
      dependencies.authUserProvisioner.createPasswordUser,
    ).not.toHaveBeenCalled();
    expect(dependencies.store.stage).not.toHaveBeenCalled();
  });

  it("delivers a generated passcode once and activates only afterwards", async () => {
    const dependencies = setup();

    await expect(inviteAccount(input, dependencies)).resolves.toEqual({
      status: "activated",
    });
    const delivery = dependencies.delivery.deliver.mock.calls[0]?.[0];
    expect(delivery).toMatchObject({ employeeNumberHint: "02" });
    expect(delivery?.temporaryPasscode).toHaveLength(20);
    expect(dependencies.store.stage).toHaveBeenCalledWith(
      expect.objectContaining({ role: "officer", employeeNumberHint: "02" }),
    );
    expect(
      dependencies.store.activate.mock.invocationCallOrder[0],
    ).toBeGreaterThan(
      dependencies.delivery.deliver.mock.invocationCallOrder[0] ?? 0,
    );
  });

  it("removes the pending account if private delivery fails", async () => {
    const dependencies = setup();
    dependencies.delivery.deliver.mockRejectedValue(
      new Error("delivery failed"),
    );

    await expect(inviteAccount(input, dependencies)).resolves.toEqual({
      status: "failed",
    });
    expect(dependencies.store.activate).not.toHaveBeenCalled();
    expect(dependencies.store.abandon).toHaveBeenCalledWith(
      "fixture-user",
      "fixture-admin",
    );
    expect(dependencies.authUserProvisioner.deleteUser).toHaveBeenCalledWith(
      "fixture-user",
    );
  });

  it("removes the provider account if private staging fails", async () => {
    const dependencies = setup();
    dependencies.store.stage.mockRejectedValue(new Error("duplicate employee"));

    await expect(inviteAccount(input, dependencies)).resolves.toEqual({
      status: "failed",
    });
    expect(dependencies.delivery.deliver).not.toHaveBeenCalled();
    expect(dependencies.authUserProvisioner.deleteUser).toHaveBeenCalledWith(
      "fixture-user",
    );
  });
});
