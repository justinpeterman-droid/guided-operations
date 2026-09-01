import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

import { ReportHistory } from "./report-history";

describe("ReportHistory", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    refresh.mockClear();
  });

  it("restores a selected prior version as a new protected revision", async () => {
    const fetch = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ csrfToken: "csrf-token" }), {
          status: 200,
        }),
      )
      .mockResolvedValueOnce(new Response("", { status: 201 }));
    vi.spyOn(globalThis.crypto, "randomUUID").mockReturnValue("a".repeat(32));
    const user = userEvent.setup();
    render(
      <ReportHistory
        reportId="11111111-1111-4111-8111-111111111111"
        currentRevisionNumber={2}
        revisions={[
          {
            revisionNumber: 2,
            reason: "Correction.",
            createdAt: "2026-08-26T00:00:00Z",
            isCurrent: true,
            restoredFromRevisionNumber: null,
          },
          {
            revisionNumber: 1,
            reason: null,
            createdAt: "2026-08-25T00:00:00Z",
            isCurrent: false,
            restoredFromRevisionNumber: null,
          },
        ]}
      />,
    );
    await user.click(
      screen.getAllByRole("button", { name: "Restore this version" })[1],
    );
    const restoreReason = screen.getByLabelText("Restore reason");
    const restoreButton = screen.getByRole("button", {
      name: "Create restored revision",
    });
    expect(restoreButton).toBeDisabled();
    await user.type(restoreReason, "   ");
    expect(restoreButton).toBeDisabled();
    await user.clear(restoreReason);
    await user.type(restoreReason, "Review correction.");
    expect(restoreButton).toBeEnabled();
    await user.click(restoreButton);
    expect(fetch).toHaveBeenNthCalledWith(
      2,
      "/api/web/v1/reports/11111111-1111-4111-8111-111111111111/restore",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          baseRevisionNumber: 2,
          restoreRevisionNumber: 1,
          reason: "Review correction.",
        }),
      }),
    );
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("offers an exact-version Word download only when the report supports it", () => {
    const revisions = [
      {
        revisionNumber: 2,
        reason: "Fictional correction.",
        createdAt: "2026-08-26T00:00:00Z",
        isCurrent: true,
        restoredFromRevisionNumber: null,
      },
      {
        revisionNumber: 1,
        reason: null,
        createdAt: "2026-08-25T00:00:00Z",
        isCurrent: false,
        restoredFromRevisionNumber: null,
      },
    ];
    const { rerender } = render(
      <ReportHistory
        allowDownload
        reportId="11111111-1111-4111-8111-111111111111"
        currentRevisionNumber={2}
        revisions={revisions}
      />,
    );
    expect(
      screen.getAllByRole("button", { name: "Download this version" }),
    ).toHaveLength(2);

    rerender(
      <ReportHistory
        reportId="11111111-1111-4111-8111-111111111111"
        currentRevisionNumber={2}
        revisions={revisions}
      />,
    );
    expect(
      screen.queryByRole("button", { name: "Download this version" }),
    ).not.toBeInTheDocument();
  });
});
