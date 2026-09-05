import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn().mockResolvedValue({}),
}));
vi.mock("next/navigation", () => ({
  usePathname: () => null,
  useRouter: vi.fn(() => ({ refresh: vi.fn() })),
}));
vi.mock("@/server/retention/private-legal-hold-store", () => ({
  createLegalHoldStore: vi.fn(() => ({})),
}));
vi.mock("@/server/retention/private-retention-deletion-store", () => ({
  createRetentionDeletionStore: vi.fn(() => ({})),
}));
vi.mock("@/server/retention/retention-deletion", () => ({
  listRetentionDeletionRequestsForCurrentSession: vi.fn().mockResolvedValue({
    kind: "listed",
    requests: [
      {
        requestId: "44444444-4444-4444-8444-444444444444",
        recordType: "incident",
        recordId: "55555555-5555-4555-8555-555555555555",
        authorityReference: "FICTIONAL-AUTHORITY-001",
        databaseBackupReference: "FICTIONAL-DB-BACKUP-001",
        storageBackupReference: "FICTIONAL-STORAGE-BACKUP-001",
        backupVerifiedAt: "2020-01-01T01:00:00.000Z",
        backupExpiresAt: "2020-01-03T01:00:00.000Z",
        artifactCount: 1,
        artifactsDeletedCount: 0,
        status: "approved",
        approvalCurrent: false,
        approvedAt: "2020-01-01T02:00:00.000Z",
        approvalExpiresAt: "2020-01-02T02:00:00.000Z",
        completedAt: null,
        databaseRowsDeleted: null,
      },
    ],
  }),
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
      screen.getByRole("heading", { name: "Deletion approval register" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Approval expired")).toBeInTheDocument();
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
