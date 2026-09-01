import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("./retention-deletion-request", () => ({
  getRetentionDeletionApproval: vi.fn(),
}));

import { getRetentionDeletionApproval } from "./retention-deletion-request";
import { ApproveRetentionDeletionForm } from "./approve-retention-deletion-form";

const recordId = "55555555-5555-4555-8555-555555555555";

describe("ApproveRetentionDeletionForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getRetentionDeletionApproval).mockResolvedValue({
      csrfToken: "csrf",
      requestId: "44444444-4444-4444-8444-444444444444",
      token: "x".repeat(43),
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
  });

  it("records backup evidence through the approval-only proof", async () => {
    render(
      <ApproveRetentionDeletionForm
        recordId={recordId}
        recordType="incident"
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Prepare deletion approval" }),
    );

    for (const label of [
      "Deletion authority reference",
      "Database backup reference",
      "Private-Storage backup reference",
    ]) {
      const pattern = screen.getByLabelText(label).getAttribute("pattern");
      expect(pattern).not.toBeNull();
      expect(() => new RegExp(pattern!, "v")).not.toThrow();
    }

    fireEvent.change(screen.getByLabelText("Deletion authority reference"), {
      target: { value: "FICTIONAL-AUTHORITY-001" },
    });
    fireEvent.change(screen.getByLabelText("Database backup reference"), {
      target: { value: "FICTIONAL-DB-BACKUP-001" },
    });
    fireEvent.change(
      screen.getByLabelText("Private-Storage backup reference"),
      { target: { value: "FICTIONAL-STORAGE-BACKUP-001" } },
    );
    fireEvent.change(
      screen.getByLabelText("Combined backup manifest SHA-256"),
      { target: { value: "a".repeat(64) } },
    );
    fireEvent.change(screen.getByLabelText("Backup restore verified at"), {
      target: { value: "2026-08-27T01:00" },
    });
    fireEvent.change(screen.getByLabelText("Backup expires at"), {
      target: { value: "2026-08-29T01:00" },
    });
    fireEvent.change(screen.getByLabelText("Your administrator passcode"), {
      target: { value: "FreshPasscode9!" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Approve only" }));

    await waitFor(() =>
      expect(getRetentionDeletionApproval).toHaveBeenCalledWith(
        "approve",
        "FreshPasscode9!",
      ),
    );
    expect(fetch).toHaveBeenCalledWith(
      "/api/admin/retention-deletions",
      expect.objectContaining({ method: "POST" }),
    );
    expect(screen.getByText("Deletion approved")).toBeInTheDocument();
    expect(refresh).toHaveBeenCalled();
  });
});
