import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { resetAccountPasscode } from "./reset-account-passcode";

const targetAuthUserId = "aaaaaaaa-0000-4000-8000-000000000001";

function dependencies() {
  return {
    authorization: vi
      .fn()
      .mockResolvedValue({ actorAuthUserId: "fixture-admin" }),
    store: { prepare: vi.fn().mockResolvedValue(undefined) },
    passwordResetter: { updatePassword: vi.fn().mockResolvedValue(true) },
    now: () => new Date("2026-08-26T12:00:00.000Z"),
  };
}

describe("resetAccountPasscode", () => {
  it("prepares a time-limited reset before changing the provider credential", async () => {
    const setup = dependencies();
    const result = await resetAccountPasscode(
      { targetAuthUserId },
      {
        authorization: { consume: setup.authorization },
        store: setup.store,
        passwordResetter: setup.passwordResetter,
        now: setup.now,
      },
    );

    expect(result).toMatchObject({ status: "reset" });
    expect(setup.store.prepare).toHaveBeenCalledWith(
      "fixture-admin",
      targetAuthUserId,
      new Date("2026-08-26T12:30:00.000Z"),
    );
    expect(setup.passwordResetter.updatePassword).toHaveBeenCalledWith(
      targetAuthUserId,
      expect.stringMatching(/^.{20}$/),
    );
  });

  it("does not prepare or change a credential without one valid proof", async () => {
    const setup = dependencies();
    setup.authorization.mockResolvedValue(null);
    await expect(
      resetAccountPasscode(
        { targetAuthUserId },
        {
          authorization: { consume: setup.authorization },
          store: setup.store,
          passwordResetter: setup.passwordResetter,
        },
      ),
    ).resolves.toEqual({ status: "denied" });
    expect(setup.store.prepare).not.toHaveBeenCalled();
    expect(setup.passwordResetter.updatePassword).not.toHaveBeenCalled();
  });

  it("does not disclose a temporary passcode when the provider change fails", async () => {
    const setup = dependencies();
    setup.passwordResetter.updatePassword.mockResolvedValue(false);
    await expect(
      resetAccountPasscode(
        { targetAuthUserId },
        {
          authorization: { consume: setup.authorization },
          store: setup.store,
          passwordResetter: setup.passwordResetter,
        },
      ),
    ).resolves.toEqual({ status: "failed" });
  });
});
