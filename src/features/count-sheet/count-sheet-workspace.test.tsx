import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { APPROVED_COUNT_SHEET_STRUCTURE } from "./approved-structure";
import { calculateCountTotals, createBlankCountPayload } from "./calculations";
import { CountSheetWorkspace } from "./count-sheet-workspace";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

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
    expect(
      screen.getByText("Incomplete — enter known values to reconcile."),
    ).toBeVisible();
    expect(
      screen.getByRole("region", {
        name: "Count entries by area and unit. Scroll horizontally to view all units.",
      }),
    ).toHaveTextContent("Swipe to view all units");
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
  }, 15_000);

  it("opens operational print only after the current saved revision audit succeeds", async () => {
    const payload = createBlankCountPayload(APPROVED_COUNT_SHEET_STRUCTURE);
    const recordId = "11111111-1111-4111-8111-111111111111";
    let releasePrintAudit: () => void = () => undefined;
    const printAudit = new Promise<Response>((resolve) => {
      releasePrintAudit = () =>
        resolve(Response.json({ data: { recorded: true } }, { status: 201 }));
    });
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (input, init) => {
        const url = String(input);
        if (url.startsWith("/api/web/v1/count-sheets?"))
          return Response.json({
            data: {
              recordId,
              workDate: "2026-08-26",
              shiftCode: "A",
              revisionNumber: 3,
              structure: APPROVED_COUNT_SHEET_STRUCTURE,
              payload,
              validation: calculateCountTotals(
                APPROVED_COUNT_SHEET_STRUCTURE,
                payload,
              ),
              updatedAt: "2026-08-26T12:00:00Z",
            },
          });
        if (url.endsWith("/revisions"))
          return Response.json({ data: { revisions: [] } });
        if (url === "/api/auth/csrf")
          return Response.json({ csrfToken: "fictional-csrf-token" });
        if (url.endsWith("/print") && init?.method === "POST")
          return printAudit;
        return Response.json({}, { status: 503 });
      });
    vi.spyOn(crypto, "randomUUID").mockReturnValue(
      "22222222-2222-4222-8222-222222222222",
    );
    const print = vi.spyOn(window, "print").mockImplementation(() => undefined);
    const user = userEvent.setup();

    render(<CountSheetWorkspace initialWorkDate="2026-08-26" shiftCode="A" />);

    expect(await screen.findByText(/Saved revision 3 loaded/)).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Print saved sheet" }));

    expect(
      await screen.findByText(/Recording the print request/),
    ).toBeVisible();
    expect(
      screen.getByRole("textbox", { name: "Chow Hall, 1" }),
    ).toBeDisabled();
    expect(print).not.toHaveBeenCalled();
    releasePrintAudit();
    expect(
      await screen.findByText(/Print request recorded.*Opening the browser/),
    ).toBeVisible();
    expect(print).toHaveBeenCalledOnce();
    const printRequest = fetchMock.mock.calls.find(([url]) =>
      String(url).endsWith("/print"),
    );
    expect(printRequest?.[0]).toBe(
      `/api/web/v1/count-sheets/${recordId}/print`,
    );
    expect(JSON.parse(String(printRequest?.[1]?.body))).toEqual({
      revisionNumber: 3,
    });
  });
});
