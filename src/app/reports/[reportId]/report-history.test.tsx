import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

import { ReportHistory } from "./report-history";

describe("ReportHistory", () => {
  it("locks a restore while pending, preserves its reason, and recovers the same request after a lost response", async () => {
    let reject!: (error: Error) => void;
    const pending = new Promise<Response>((_, r) => {
      reject = r;
    });
    let attempts = 0;
    const fetch = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (_, init) => {
        if (!init?.method)
          return Response.json({ csrfToken: "fictional-token" });
        attempts++;
        if (attempts === 1) return pending;
        return Response.json({ data: { revisionNumber: 3 } }, { status: 201 });
      });
    const user = userEvent.setup();
    render(
      <ReportHistory
        reportId="11111111-1111-4111-8111-111111111111"
        currentRevisionNumber={2}
        revisions={[
          {
            revisionNumber: 1,
            reason: "Fictional original.",
            createdAt: "2026-08-26T00:00:00Z",
            isCurrent: false,
            restoredFromRevisionNumber: null,
          },
        ]}
      />,
    );
    await user.click(
      screen.getByRole("button", { name: "Restore this version" }),
    );
    await user.type(
      screen.getByLabelText("Restore reason"),
      "Fictional reviewed restore.",
    );
    await user.click(
      screen.getByRole("button", { name: "Create restored revision" }),
    );
    await waitFor(() => expect(attempts).toBe(1));
    expect(screen.getByLabelText("Restore reason")).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Restore this version" }),
    ).toBeDisabled();
    await act(async () => reject(new Error("fictional lost response")));
    expect(
      await screen.findByText(/Restore could not be confirmed/),
    ).toBeVisible();
    expect(screen.getByLabelText("Restore reason")).toHaveValue(
      "Fictional reviewed restore.",
    );
    await user.click(
      screen.getByRole("button", { name: "Create restored revision" }),
    );
    expect(await screen.findByText("Restored as revision 3.")).toBeVisible();
    const calls = fetch.mock.calls.filter(
      ([, init]) => init?.method === "POST",
    );
    expect(calls[1][1]).toEqual(calls[0][1]);
    expect(screen.queryByLabelText("Restore reason")).toBeNull();
    expect(
      screen.getByRole("button", { name: "Restore this version" }),
    ).toBeDisabled();
  });
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
      .mockResolvedValueOnce(
        Response.json({ data: { revisionNumber: 3 } }, { status: 201 }),
      );
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
