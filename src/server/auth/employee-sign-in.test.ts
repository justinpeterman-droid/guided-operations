import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  createEmployeeLookupDigest,
  signInWithEmployeeNumber,
  type EmployeeSignInDependencies,
} from "./employee-sign-in";

const hmacKey = "test-only-hmac-key";

function dependencies(
  activeAlias: string | null,
  passwordAccepted: boolean,
): EmployeeSignInDependencies {
  return {
    employeeLookupHmacKey: hmacKey,
    dummyAlias: "dummy-auth-alias@example.invalid",
    aliasLookup: {
      findActiveAlias: vi.fn().mockResolvedValue(
        activeAlias
          ? {
              alias: activeAlias,
              authUserId: "11111111-1111-4111-8111-111111111111",
            }
          : null,
      ),
    },
    passwordAuthenticator: {
      signInWithPassword: vi
        .fn()
        .mockResolvedValue(
          passwordAccepted
            ? { authUserId: "11111111-1111-4111-8111-111111111111" }
            : null,
        ),
    },
  };
}

describe("createEmployeeLookupDigest", () => {
  it("is deterministic, keyed, and does not return the employee number", () => {
    const digest = createEmployeeLookupDigest("EMP-42", hmacKey);

    expect(digest).toMatch(/^[a-f0-9]{64}$/);
    expect(digest).toBe(createEmployeeLookupDigest("EMP-42", hmacKey));
    expect(digest).not.toBe(createEmployeeLookupDigest("EMP-42", "other-key"));
    expect(digest).not.toContain("EMP-42");
  });
});

describe("signInWithEmployeeNumber", () => {
  it("looks up a normalized, keyed employee digest and signs in with the alias", async () => {
    const setup = dependencies("private-alias@example.invalid", true);

    await expect(
      signInWithEmployeeNumber(" emp-42 ", "Cedar7!9", setup),
    ).resolves.toEqual({ status: "signed_in" });
    expect(setup.aliasLookup.findActiveAlias).toHaveBeenCalledWith(
      createEmployeeLookupDigest("EMP-42", hmacKey),
    );
    expect(setup.passwordAuthenticator.signInWithPassword).toHaveBeenCalledWith(
      "private-alias@example.invalid",
      "Cedar7!9",
    );
  });

  it("uses the dummy path and one generic response for an unknown employee", async () => {
    const setup = dependencies(null, false);

    await expect(
      signInWithEmployeeNumber("unknown", "wrong-secret", setup),
    ).resolves.toEqual({
      status: "failed",
      message: "Unable to sign in with those credentials.",
    });
    expect(setup.passwordAuthenticator.signInWithPassword).toHaveBeenCalledWith(
      setup.dummyAlias,
      "wrong-secret",
    );
  });

  it("returns the same generic response for a wrong secret on a known employee", async () => {
    const setup = dependencies("private-alias@example.invalid", false);

    await expect(
      signInWithEmployeeNumber("emp-42", "wrong-secret", setup),
    ).resolves.toEqual({
      status: "failed",
      message: "Unable to sign in with those credentials.",
    });
  });

  it("rejects a successful Auth response for a different private account", async () => {
    const setup = dependencies("private-alias@example.invalid", true);
    setup.passwordAuthenticator.signInWithPassword = vi.fn().mockResolvedValue({
      authUserId: "22222222-2222-4222-8222-222222222222",
    });

    await expect(
      signInWithEmployeeNumber("emp-42", "Cedar7!9", setup),
    ).resolves.toEqual({
      status: "failed",
      message: "Unable to sign in with those credentials.",
    });
  });
});
