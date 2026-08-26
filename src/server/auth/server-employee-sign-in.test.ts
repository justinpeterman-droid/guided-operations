import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/env/auth-server", () => ({
  getAuthServerEnvironment: vi.fn(() => ({
    EMPLOYEE_LOOKUP_PEPPER: "p".repeat(32),
    AUTH_DUMMY_ALIAS: "dummy@example.invalid",
  })),
}));
vi.mock("./private-alias-lookup", () => ({
  createPrivateAuthAliasLookup: vi.fn(() => "lookup"),
}));
vi.mock("./private-auth-attempt-store", () => ({
  createAuthAttemptStore: vi.fn(() => "attempt-store"),
}));
vi.mock("./supabase-auth-adapters", () => ({
  createSupabasePasswordAuthenticator: vi.fn(async () => "authenticator"),
}));

import { createServerEmployeeSignInDependencies } from "./server-employee-sign-in";

const policy = {
  account: { limit: 3, windowMs: 60_000 },
  device: { limit: 4, windowMs: 60_000 },
  network: { limit: 5, windowMs: 60_000 },
  global: { limit: 10, windowMs: 60_000 },
};

describe("createServerEmployeeSignInDependencies", () => {
  it("composes private adapters without a browser credential or implicit policy", async () => {
    await expect(
      createServerEmployeeSignInDependencies(policy),
    ).resolves.toEqual({
      policy,
      attemptStore: "attempt-store",
      employeeSignIn: {
        employeeLookupHmacKey: "p".repeat(32),
        dummyAlias: "dummy@example.invalid",
        aliasLookup: "lookup",
        passwordAuthenticator: "authenticator",
      },
    });
  });
});
