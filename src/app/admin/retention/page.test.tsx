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
  listRetentionReviewForCurrentSession: vi.fn().mockResolvedValue({
    kind: "listed",
    candidates: [
      {
        recordType: "incident",
        recordId: "33333333-3333-4333-8333-333333333333",
        archivedAt: "2024-01-01T03:00:00.000Z",
        deletionEligibleAt: "2025-12-31T03:00:00.000Z",
        activeLegalHold: true,
        deletionReady: false,
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
      screen.getByRole("heading", { name: "Two-year deletion review" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Protected by legal hold")).toBeInTheDocument();
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
