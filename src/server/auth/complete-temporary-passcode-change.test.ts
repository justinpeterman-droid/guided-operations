import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { completeTemporaryPasscodeChange } from "./complete-temporary-passcode-change";

const employeeLookupHmacKey = "p".repeat(32);
const authUserId = "aaaaaaaa-0000-4000-8000-000000000001";

function dependencies() {
  return {
    employeeLookupHmacKey,
    store: { complete: vi.fn().mockResolvedValue(undefined) },
  };
}

function client() {
  return {
    auth: {
      updateUser: vi.fn().mockResolvedValue({ error: null }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
  };
}

describe("completeTemporaryPasscodeChange", () => {
  it("updates a valid personal passcode, completes the private state, and globally signs out", async () => {
    const deps = dependencies();
    const auth = client();

    await expect(
      completeTemporaryPasscodeChange(
        { employeeNumber: " emp-42 ", passcode: "Cedar7!9" },
        authUserId,
        auth,
        deps,
      ),
    ).resolves.toEqual({ status: "completed" });

    expect(auth.auth.updateUser).toHaveBeenCalledWith({ password: "Cedar7!9" });
    expect(deps.store.complete).toHaveBeenCalledWith({
      authUserId,
      employeeLookupDigest: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
    expect(auth.auth.signOut).toHaveBeenCalledWith({ scope: "global" });
  });

  it("rejects unsafe values before invoking Auth or the private store", async () => {
    const deps = dependencies();
    const auth = client();

    await expect(
      completeTemporaryPasscodeChange(
        { employeeNumber: "EMP-42", passcode: "EMP-42" },
        authUserId,
        auth,
        deps,
      ),
    ).resolves.toEqual({ status: "invalid_input" });

    expect(auth.auth.updateUser).not.toHaveBeenCalled();
    expect(deps.store.complete).not.toHaveBeenCalled();
  });

  it("does not clear the private forced-change state when the provider update fails", async () => {
    const deps = dependencies();
    const auth = client();
    auth.auth.updateUser.mockResolvedValue({ error: new Error("unavailable") });

    await expect(
      completeTemporaryPasscodeChange(
        { employeeNumber: "EMP-42", passcode: "Cedar7!9" },
        authUserId,
        auth,
        deps,
      ),
    ).resolves.toEqual({ status: "unavailable" });

    expect(deps.store.complete).not.toHaveBeenCalled();
    expect(auth.auth.signOut).not.toHaveBeenCalled();
  });
});
