import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn().mockResolvedValue({}),
}));
vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({ refresh: vi.fn() })),
}));
vi.mock("@/server/retention/private-legal-hold-store", () => ({
  createLegalHoldStore: vi.fn(() => ({})),
}));
vi.mock("@/server/retention/legal-hold", () => ({
  listLegalHoldsForCurrentSession: vi.fn().mockResolvedValue({
    kind: "listed",
    holds: [
      {
        holdId: "11111111-1111-4111-8111-111111111111",
        scopeType: "incident",
        scopeId: "22222222-2222-4222-8222-222222222222",
        authorityReference: "FICTIONAL-HOLD-001",
        createdAt: "2026-08-27T03:00:00.000Z",
        releasedAt: null,
        releaseAuthorityReference: null,
      },
    ],
  }),
}));

import AdminRetentionPage from "./page";

describe("AdminRetentionPage", () => {
  it("shows a protected hold register and no deletion action", async () => {
    render(await AdminRetentionPage());

    expect(
      screen.getByRole("heading", { name: "Retention and legal holds" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/FICTIONAL-HOLD-001/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Confirm legal hold" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Release hold" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /delete/i }),
    ).not.toBeInTheDocument();
  });
});
