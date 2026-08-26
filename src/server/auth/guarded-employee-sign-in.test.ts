import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  createAuthAttemptSubjectDigest,
  signInWithEmployeeNumberGuarded,
  type AuthAttemptStore,
  type GuardedSignInDependencies,
} from "./guarded-employee-sign-in";

const key = "test-only-hmac-key";
const now = new Date("2026-08-26T12:00:00.000Z");
const policy = {
  account: { limit: 3, windowMs: 60_000 },
  device: { limit: 4, windowMs: 60_000 },
  network: { limit: 5, windowMs: 60_000 },
  global: { limit: 10, windowMs: 60_000 },
};

function digest(kind: "device" | "network" | "global"): string {
  return createAuthAttemptSubjectDigest(kind, `fixture-${kind}`, key);
}

function setup(attempts: readonly number[] = []): {
  dependencies: GuardedSignInDependencies;
  store: AuthAttemptStore;
  authenticator: ReturnType<typeof vi.fn>;
} {
  const store: AuthAttemptStore = {
    listOccurredAt: vi.fn().mockResolvedValue(attempts),
    record: vi.fn().mockResolvedValue(undefined),
  };
  const authenticator = vi.fn().mockResolvedValue(true);
  return {
    store,
    authenticator,
    dependencies: {
      policy,
      attemptStore: store,
      employeeSignIn: {
        employeeLookupHmacKey: key,
        dummyAlias: "dummy-auth-alias@example.invalid",
        aliasLookup: {
          findActiveAlias: vi
            .fn()
            .mockResolvedValue({ alias: "private-alias@example.invalid" }),
        },
        passwordAuthenticator: { signInWithPassword: authenticator },
      },
    },
  };
}

const request = {
  employeeNumber: " EMP-42 ",
  passcode: "Cedar7!9",
  deviceDigest: digest("device"),
  networkDigest: digest("network"),
  globalDigest: digest("global"),
};

describe("createAuthAttemptSubjectDigest", () => {
  it("uses a purpose-separated keyed digest", () => {
    const account = createAuthAttemptSubjectDigest("account", "EMP-42", key);

    expect(account).toMatch(/^[a-f0-9]{64}$/);
    expect(account).not.toContain("EMP-42");
    expect(account).not.toBe(
      createAuthAttemptSubjectDigest("network", "EMP-42", key),
    );
    expect(account).not.toBe(
      createAuthAttemptSubjectDigest("account", "EMP-42", "other-key"),
    );
  });
});

describe("signInWithEmployeeNumberGuarded", () => {
  it("checks all four opaque subjects before authenticating and records success", async () => {
    const { dependencies, store, authenticator } = setup();

    await expect(
      signInWithEmployeeNumberGuarded(request, dependencies, now),
    ).resolves.toEqual({ status: "signed_in" });
    expect(store.listOccurredAt).toHaveBeenCalledTimes(4);
    expect(authenticator).toHaveBeenCalledOnce();
    expect(store.record).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ kind: "account" }),
        expect.objectContaining({
          kind: "device",
          digest: request.deviceDigest,
        }),
        expect.objectContaining({
          kind: "network",
          digest: request.networkDigest,
        }),
        expect.objectContaining({
          kind: "global",
          digest: request.globalDigest,
        }),
      ]),
      "allowed",
      new Date("2026-08-26T12:01:00.000Z"),
    );
  });

  it("does not look up or authenticate an account when any rate-limit dimension denies", async () => {
    const { dependencies, store, authenticator } = setup([
      now.getTime() - 30_000,
      now.getTime() - 20_000,
      now.getTime() - 10_000,
    ]);

    await expect(
      signInWithEmployeeNumberGuarded(request, dependencies, now),
    ).resolves.toEqual({
      status: "failed",
      message: "Unable to sign in with those credentials.",
    });
    expect(
      dependencies.employeeSignIn.aliasLookup.findActiveAlias,
    ).not.toHaveBeenCalled();
    expect(authenticator).not.toHaveBeenCalled();
    expect(store.record).toHaveBeenCalledWith(
      expect.any(Array),
      "denied",
      expect.any(Date),
    );
  });

  it("records a generic failed outcome when authentication fails", async () => {
    const { dependencies, store, authenticator } = setup();
    authenticator.mockResolvedValue(false);

    await expect(
      signInWithEmployeeNumberGuarded(request, dependencies, now),
    ).resolves.toEqual({
      status: "failed",
      message: "Unable to sign in with those credentials.",
    });
    expect(store.record).toHaveBeenCalledWith(
      expect.any(Array),
      "failed",
      expect.any(Date),
    );
  });
});
