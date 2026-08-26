import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const createUser = vi.fn();
const deleteUser = vi.fn();

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({ auth: { admin: { createUser, deleteUser } } })),
}));
vi.mock("@/lib/env/auth-server", () => ({
  getAuthServerEnvironment: vi.fn(() => ({ SUPABASE_SECRET_KEY: "secret" })),
}));
vi.mock("@/lib/env/supabase-public", () => ({
  getPublicSupabaseEnvironment: vi.fn(() => ({
    NEXT_PUBLIC_SUPABASE_URL: "https://example.invalid",
  })),
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(),
}));

import { createSupabaseAuthUserProvisioner } from "./supabase-auth-adapters";

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
