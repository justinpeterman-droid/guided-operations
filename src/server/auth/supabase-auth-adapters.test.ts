import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const createUser = vi.fn();
const deleteUser = vi.fn();
const updateUserById = vi.fn();
const signInWithPassword = vi.fn();

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    auth: {
      admin: { createUser, deleteUser, updateUserById },
      signInWithPassword,
    },
  })),
}));
vi.mock("@/lib/env/auth-server", () => ({
  getAuthServerEnvironment: vi.fn(() => ({ SUPABASE_SECRET_KEY: "secret" })),
}));
vi.mock("@/lib/env/supabase-public", () => ({
  getPublicSupabaseEnvironment: vi.fn(() => ({
    NEXT_PUBLIC_SUPABASE_URL: "https://example.invalid",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "publishable-key",
  })),
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(),
}));

import {
  createSupabaseAdministratorPasscodeVerifier,
  createSupabaseAuthPasswordResetter,
  createSupabaseAuthUserProvisioner,
} from "./supabase-auth-adapters";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createSupabaseAuthUserProvisioner", () => {
  it("uses the isolated Auth admin API to create a confirmed synthetic alias", async () => {
    createUser.mockResolvedValue({
      data: { user: { id: "fixture-user" } },
      error: null,
    });
    const provisioner = createSupabaseAuthUserProvisioner();

    await expect(
      provisioner.createPasswordUser({
        alias: "fixture@example.invalid",
        passcode: "GeneratedFixturePasscode1",
      }),
    ).resolves.toEqual({ authUserId: "fixture-user" });

    expect(createUser).toHaveBeenCalledWith({
      email: "fixture@example.invalid",
      password: "GeneratedFixturePasscode1",
      email_confirm: true,
    });
  });

  it("does not leak provider errors and raises on failed cleanup", async () => {
    createUser.mockResolvedValue({
      data: { user: null },
      error: new Error("no"),
    });
    deleteUser.mockResolvedValue({ error: new Error("no") });
    const provisioner = createSupabaseAuthUserProvisioner();

    await expect(
      provisioner.createPasswordUser({
        alias: "fixture@example.invalid",
        passcode: "GeneratedFixturePasscode1",
      }),
    ).resolves.toBeNull();
    await expect(provisioner.deleteUser("fixture-user")).rejects.toThrow(
      "Unable to remove pending Auth user.",
    );
  });
});

describe("createSupabaseAdministratorPasscodeVerifier", () => {
  it("uses an isolated provider client and accepts only the matching administrator", async () => {
    signInWithPassword.mockResolvedValue({
      data: { user: { id: "fixture-user" } },
      error: null,
    });
    const verifier = createSupabaseAdministratorPasscodeVerifier({
      findActiveAlias: vi.fn().mockResolvedValue("private@example.invalid"),
    });

    await expect(
      verifier.verify("fixture-user", "FreshPasscode9!"),
    ).resolves.toBe(true);
    expect(signInWithPassword).toHaveBeenCalledWith({
      email: "private@example.invalid",
      password: "FreshPasscode9!",
    });
  });

  it("fails closed for a missing alias, provider error, or mismatched account", async () => {
    const missing = createSupabaseAdministratorPasscodeVerifier({
      findActiveAlias: vi.fn().mockResolvedValue(null),
    });
    await expect(
      missing.verify("fixture-user", "FreshPasscode9!"),
    ).resolves.toBe(false);

    signInWithPassword.mockResolvedValue({
      data: { user: { id: "other-user" } },
      error: null,
    });
    const mismatched = createSupabaseAdministratorPasscodeVerifier({
      findActiveAlias: vi.fn().mockResolvedValue("private@example.invalid"),
    });
    await expect(
      mismatched.verify("fixture-user", "FreshPasscode9!"),
    ).resolves.toBe(false);
  });
});

describe("createSupabaseAuthPasswordResetter", () => {
  it("retries one temporary provider failure with the same replacement credential", async () => {
    updateUserById
      .mockResolvedValueOnce({ error: { status: 503 } })
      .mockResolvedValueOnce({ error: null });

    await expect(
      createSupabaseAuthPasswordResetter().updatePassword(
        "fixture-user",
        "GeneratedFixturePasscode1",
      ),
    ).resolves.toBe(true);

    expect(updateUserById).toHaveBeenCalledTimes(2);
    expect(updateUserById).toHaveBeenNthCalledWith(1, "fixture-user", {
      password: "GeneratedFixturePasscode1",
    });
    expect(updateUserById).toHaveBeenNthCalledWith(2, "fixture-user", {
      password: "GeneratedFixturePasscode1",
    });
  });

  it("does not retry a permanent provider rejection", async () => {
    updateUserById.mockResolvedValueOnce({ error: { status: 422 } });

    await expect(
      createSupabaseAuthPasswordResetter().updatePassword(
        "fixture-user",
        "GeneratedFixturePasscode1",
      ),
    ).resolves.toBe(false);

    expect(updateUserById).toHaveBeenCalledTimes(1);
  });
});
