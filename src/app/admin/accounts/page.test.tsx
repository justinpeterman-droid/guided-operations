import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn().mockResolvedValue({}),
}));
vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({ refresh: vi.fn() })),
}));
vi.mock("@/server/auth/list-admin-accounts", () => ({
  listAdminAccountsForCurrentSession: vi.fn().mockResolvedValue({
    kind: "listed",
    accounts: [
      {
        accountId: "11111111-1111-4111-8111-111111111111",
        employeeNumberHint: "42",
        displayName: "Fictional Officer",
        role: "officer",
        status: "active",
        mustChangePasscode: false,
        updatedAt: "2026-08-26T12:00:00Z",
      },
    ],
  }),
}));

import AdminAccountsPage from "./page";

describe("AdminAccountsPage", () => {
  it("renders the protected list with fresh-confirmation account controls", async () => {
    render(await AdminAccountsPage());

    expect(
      screen.getByRole("heading", { name: "Accounts and roster" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Fictional Officer")).toBeInTheDocument();
    expect(screen.getByText("Employee ending 42")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Disable account" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Reset passcode" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Make administrator" }),
    ).toBeInTheDocument();
  });
});
