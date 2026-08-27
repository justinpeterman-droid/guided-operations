import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("./retention-deletion-request", () => ({
  getRetentionDeletionApproval: vi.fn(),
}));

import { getRetentionDeletionApproval } from "./retention-deletion-request";
import { ExecuteRetentionDeletionControl } from "./execute-retention-deletion-control";

const requestId = "44444444-4444-4444-8444-444444444444";
const recordId = "55555555-5555-4555-8555-555555555555";

describe("ExecuteRetentionDeletionControl", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getRetentionDeletionApproval).mockResolvedValue({
      csrfToken: "csrf",
      requestId: "66666666-6666-4666-8666-666666666666",
      token: "x".repeat(43),
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
  });

  it("requires the exact record ID before requesting a fresh execution proof", async () => {
    render(
      <ExecuteRetentionDeletionControl
        requestId={requestId}
        recordId={recordId}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Review permanent deletion" }),
    );

    fireEvent.change(
      screen.getByLabelText("Type the exact record ID to continue"),
      { target: { value: "11111111-1111-4111-8111-111111111111" } },
    );
    fireEvent.change(
      screen.getByLabelText("Re-enter your administrator passcode"),
      { target: { value: "FreshPasscode9!" } },
    );
    fireEvent.submit(
      screen
        .getByRole("button", { name: "Permanently delete" })
        .closest("form")!,
    );
    expect(getRetentionDeletionApproval).not.toHaveBeenCalled();

    fireEvent.click(
      screen.getByRole("button", { name: "Review permanent deletion" }),
    );
    fireEvent.change(
      screen.getByLabelText("Type the exact record ID to continue"),
      { target: { value: recordId } },
    );
    fireEvent.change(
      screen.getByLabelText("Re-enter your administrator passcode"),
      { target: { value: "FreshPasscode9!" } },
    );
    fireEvent.submit(
      screen
        .getByRole("button", { name: "Permanently delete" })
        .closest("form")!,
    );

    await waitFor(() =>
      expect(getRetentionDeletionApproval).toHaveBeenCalledWith(
        "execute",
        "FreshPasscode9!",
      ),
    );
    expect(fetch).toHaveBeenCalledWith(
      `/api/admin/retention-deletions/${requestId}/execute`,
      expect.objectContaining({ method: "POST" }),
    );
    expect(screen.getByText("Deletion completed")).toBeInTheDocument();
    expect(refresh).toHaveBeenCalled();
  });
});
