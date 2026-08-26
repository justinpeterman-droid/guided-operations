import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { changePersonalPasscode } from "./change-personal-passcode";

const authUserId = "aaaaaaaa-0000-4000-8000-000000000001";
const input = {
  employeeNumber: " EMP-42 ",
  currentPasscode: "Current9!",
  newPasscode: "Cedar7!9",
};

function setup() {
  return {
    client: {
      auth: { signOut: vi.fn().mockResolvedValue({ error: null }) },
    },
    dependencies: {
      employeeLookupHmacKey: "p".repeat(32),
      verifier: { verify: vi.fn().mockResolvedValue(true) },
      updater: { updatePassword: vi.fn().mockResolvedValue(true) },
      store: {
        verifyIdentity: vi.fn().mockResolvedValue(true),
        prepare: vi.fn().mockResolvedValue(undefined),
        record: vi.fn().mockResolvedValue(undefined),
      },
    },
  };
}

describe("changePersonalPasscode", () => {
  it("verifies the current credential and keyed identity before changing and revoking", async () => {
    const { client, dependencies } = setup();

    await expect(
      changePersonalPasscode(input, authUserId, client, dependencies),
    ).resolves.toBe("changed");

    expect(dependencies.verifier.verify).toHaveBeenCalledWith(
      authUserId,
      "Current9!",
    );
    expect(dependencies.updater.updatePassword).toHaveBeenCalledWith(
      authUserId,
      "Cedar7!9",
    );
    expect(dependencies.store.prepare).toHaveBeenCalledWith(
      authUserId,
      expect.stringMatching(/^[a-f0-9]{64}$/),
    );
    expect(dependencies.store.record).toHaveBeenCalledWith(
      authUserId,
      expect.stringMatching(/^[a-f0-9]{64}$/),
    );
    expect(client.auth.signOut).toHaveBeenCalledWith({ scope: "global" });
  });

  it("rejects a wrong current credential or employee identity before updating", async () => {
    const { client, dependencies } = setup();
    dependencies.verifier.verify.mockResolvedValue(false);

    await expect(
      changePersonalPasscode(input, authUserId, client, dependencies),
    ).resolves.toBe("invalid_input");

    expect(dependencies.updater.updatePassword).not.toHaveBeenCalled();
    expect(client.auth.signOut).not.toHaveBeenCalled();
  });

  it("revokes current sessions when the provider update fails after preparation", async () => {
    const { client, dependencies } = setup();
    dependencies.updater.updatePassword.mockResolvedValue(false);

    await expect(
      changePersonalPasscode(input, authUserId, client, dependencies),
    ).resolves.toBe("failed");

    expect(dependencies.store.prepare).toHaveBeenCalled();
    expect(client.auth.signOut).toHaveBeenCalledWith({ scope: "global" });
    expect(dependencies.store.record).not.toHaveBeenCalled();
  });

  it("signs out globally even when audit recording fails after the provider update", async () => {
    const { client, dependencies } = setup();
    dependencies.store.record.mockRejectedValue(new Error("unavailable"));

    await expect(
      changePersonalPasscode(input, authUserId, client, dependencies),
    ).resolves.toBe("failed");

    expect(client.auth.signOut).toHaveBeenCalledWith({ scope: "global" });
  });
});
