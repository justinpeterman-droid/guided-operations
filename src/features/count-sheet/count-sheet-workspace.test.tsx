import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { APPROVED_COUNT_SHEET_STRUCTURE } from "./approved-structure";
import { calculateCountTotals, createBlankCountPayload } from "./calculations";
import { CountSheetWorkspace } from "./count-sheet-workspace";

afterEach(() => vi.restoreAllMocks());

describe("CountSheetWorkspace", () => {
  it("loads a blank assigned-shift sheet and saves entered values as revision one", async () => {
    const payload = createBlankCountPayload(APPROVED_COUNT_SHEET_STRUCTURE);
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        Response.json({
          data: {
            recordId: null,
            workDate: "2026-08-26",
            shiftCode: "A",
            revisionNumber: 0,
            structure: APPROVED_COUNT_SHEET_STRUCTURE,
            payload,
            validation: calculateCountTotals(
              APPROVED_COUNT_SHEET_STRUCTURE,
              payload,
            ),
            updatedAt: null,
          },
        }),
      )
      .mockResolvedValueOnce(
        Response.json({ csrfToken: "fictional-csrf-token" }),
      )
      .mockResolvedValueOnce(
        Response.json(
          {
            data: {
              recordId: "11111111-1111-4111-8111-111111111111",
              revisionNumber: 1,
            },
          },
          { status: 201 },
        ),
      );
    vi.spyOn(crypto, "randomUUID").mockReturnValue(
      "22222222-2222-4222-8222-222222222222",
    );
    const user = userEvent.setup();

    render(<CountSheetWorkspace initialWorkDate="2026-08-26" shiftCode="A" />);

    expect(
      await screen.findByText(/No saved sheet exists for this date/),
    ).toBeVisible();
    await user.type(screen.getByRole("textbox", { name: "Chow Hall, 1" }), "2");
    await user.type(
      screen.getByRole("textbox", { name: "In housing, 1" }),
      "8",
    );
    await user.type(
      screen.getByRole("textbox", { name: "Operational total, on site" }),
      "10",
    );
    await user.click(screen.getByRole("button", { name: "Save new revision" }));

    expect(await screen.findByText(/Saved as revision 1/)).toBeVisible();
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/api/web/v1/count-sheets?work_date=2026-08-26",
      {
        cache: "no-store",
        credentials: "same-origin",
        signal: expect.any(AbortSignal),
      },
    );
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/auth/csrf", {
      cache: "no-store",
      credentials: "same-origin",
    });
    const saveRequest = fetchMock.mock.calls[2];
    expect(saveRequest[0]).toBe("/api/web/v1/count-sheets");
    expect(saveRequest[1]).toMatchObject({ method: "POST" });
    expect(JSON.parse(String(saveRequest[1]?.body))).toMatchObject({
      workDate: "2026-08-26",
      baseRevisionNumber: 0,
      payload: {
        cells: { "Chow Hall": { "1": 2 } },
        in_housing: { "1": 8 },
        operational: { on_site: 10 },
      },
    });
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Print saved sheet" }),
      ).toBeEnabled(),
    );
  });
});
