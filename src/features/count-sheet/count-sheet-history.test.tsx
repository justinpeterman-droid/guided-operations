import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { APPROVED_COUNT_SHEET_STRUCTURE } from "./approved-structure";
import { calculateCountTotals, createBlankCountPayload } from "./calculations";
import { CountSheetHistory } from "./count-sheet-history";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const recordId = "11111111-1111-4111-8111-111111111111";
const payload = createBlankCountPayload(APPROVED_COUNT_SHEET_STRUCTURE);
const validation = calculateCountTotals(
  APPROVED_COUNT_SHEET_STRUCTURE,
  payload,
);
const historyResponse = {
  data: {
    revisions: [
      {
        revisionNumber: 2,
        reason: "Fictional correction.",
        validation,
        createdAt: "2026-08-26T12:00:00Z",
        isCurrent: true,
        restoredFromRevisionNumber: null,
      },
      {
        revisionNumber: 1,
        reason: "Fictional initial sheet.",
        validation,
        createdAt: "2026-08-26T11:00:00Z",
        isCurrent: false,
        restoredFromRevisionNumber: null,
      },
    ],
  },
};

describe("CountSheetHistory", () => {
  it("loads revision metadata and opens a validated saved version for review", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(Response.json(historyResponse))
      .mockResolvedValueOnce(
        Response.json({
          data: {
            revisionNumber: 1,
            reason: "Fictional initial sheet.",
            payload,
            createdAt: "2026-08-26T11:00:00Z",
          },
        }),
      );
    const onReview = vi.fn();
    const user = userEvent.setup();
    render(
      <CountSheetHistory
        currentRevisionNumber={2}
        onRestored={vi.fn()}
        onReview={onReview}
        recordId={recordId}
      />,
    );

    expect(await screen.findByText(/Revision 2 \(current\)/)).toBeVisible();
    const reviewButtons = screen.getAllByRole("button", {
      name: "Review this version",
    });
    await user.click(reviewButtons[1]);

    expect(await screen.findByText(/Revision 1 is shown above/)).toBeVisible();
    expect(onReview).toHaveBeenCalledWith(
      expect.objectContaining({ revisionNumber: 1, payload }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      `/api/web/v1/count-sheets/${recordId}/revisions?revision_number=1`,
      { cache: "no-store", credentials: "same-origin" },
    );
  });

  it("restores an older version only as a new revision with CSRF and retry protection", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(Response.json(historyResponse))
      .mockResolvedValueOnce(
        Response.json({ csrfToken: "fictional-csrf-token" }),
      )
      .mockResolvedValueOnce(
        Response.json({ data: { revisionNumber: 3 } }, { status: 201 }),
      );
    vi.spyOn(crypto, "randomUUID").mockReturnValue(
      "22222222-2222-4222-8222-222222222222",
    );
    const onRestored = vi.fn();
    const user = userEvent.setup();
    render(
      <CountSheetHistory
        currentRevisionNumber={2}
        onRestored={onRestored}
        onReview={vi.fn()}
        recordId={recordId}
      />,
    );

    const restoreButtons = await screen.findAllByRole("button", {
      name: "Restore this version",
    });
    expect(restoreButtons[0]).toBeDisabled();
    await user.click(restoreButtons[1]);
    await user.type(
      screen.getByRole("textbox", { name: "Restore reason" }),
      "Return to the earlier fictional count.",
    );
    await user.click(
      screen.getByRole("button", { name: "Create restored revision" }),
    );

    await waitFor(() => expect(onRestored).toHaveBeenCalledOnce());
    const restoreRequest = fetchMock.mock.calls[2];
    expect(restoreRequest[0]).toBe(
      `/api/web/v1/count-sheets/${recordId}/restore`,
    );
    expect(restoreRequest[1]).toMatchObject({ method: "POST" });
    expect(JSON.parse(String(restoreRequest[1]?.body))).toEqual({
      baseRevisionNumber: 2,
      restoreRevisionNumber: 1,
      reason: "Return to the earlier fictional count.",
    });
  });
});
