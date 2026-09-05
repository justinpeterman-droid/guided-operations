import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
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
  it("keeps history actions unavailable while counts are unsaved", async () => {
    const payload = createBlankCountPayload(APPROVED_COUNT_SHEET_STRUCTURE);
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (url) => {
        if (String(url).includes("revision_number=1")) {
          const earlier = structuredClone(payload);
          earlier.in_housing["9"] = 0;
          return Response.json({
            data: {
              revisionNumber: 1,
              reason: "Fictional earlier sheet.",
              payload: earlier,
              createdAt: "2026-08-26T12:00:00Z",
            },
          });
        }
        if (String(url).endsWith("/revisions"))
          return Response.json({
            data: {
              revisions: [
                {
                  revisionNumber: 1,
                  reason: "Fictional earlier sheet.",
                  validation: calculateCountTotals(
                    APPROVED_COUNT_SHEET_STRUCTURE,
                    payload,
                  ),
                  createdAt: "2026-08-26T12:00:00Z",
                  isCurrent: false,
                  restoredFromRevisionNumber: null,
                },
              ],
            },
          });
        return Response.json({
          data: {
            recordId: "11111111-1111-4111-8111-111111111111",
            workDate: "2026-08-26",
            shiftCode: "A",
            revisionNumber: 2,
            structure: APPROVED_COUNT_SHEET_STRUCTURE,
            payload,
            updatedAt: null,
          },
        });
      });
    const user = userEvent.setup();
    render(<CountSheetWorkspace initialWorkDate="2026-08-26" shiftCode="A" />);
    // The full count grid renders before its separate history request completes.
    // Shared CI runners can take longer than Testing Library's default second.
    await screen.findByText(
      "Fictional earlier sheet.",
      { exact: false },
      { timeout: 5000 },
    );
    expect(
      screen.getByRole("button", { name: "Restore this version" }),
    ).toBeEnabled();
    await user.click(
      screen.getByRole("button", { name: "Review this version" }),
    );
    expect(
      await screen.findByRole("heading", { name: "Compare saved versions" }),
    ).toBeVisible();
    expect(
      screen.getByRole("columnheader", { name: "Current r2" }),
    ).toBeVisible();
    expect(screen.getByLabelText("In housing, 9")).toHaveValue("0");
    await user.click(
      screen.getByRole("button", { name: "Return to current version" }),
    );
    expect(screen.getByLabelText("In housing, 9")).toHaveValue("");
    expect(
      screen.queryByRole("heading", { name: "Compare saved versions" }),
    ).toBeNull();
    await user.type(screen.getByLabelText("In housing, 9"), "9");
    expect(
      screen.getByRole("button", { name: "Restore this version" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Review this version" }),
    ).toBeDisabled();
    expect(screen.getByLabelText("In housing, 9")).toHaveValue("9");
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
  it("reuses an unchanged save after an interrupted response and creates a new key for changed counts", async () => {
    const payload = createBlankCountPayload(APPROVED_COUNT_SHEET_STRUCTURE);
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (url, init) => {
        if (url === "/api/auth/csrf")
          return Response.json({ csrfToken: "fictional-token" });
        if (init?.method === "POST")
          throw new Error("fictional interrupted response");
        return Response.json({
          data: {
            recordId: null,
            workDate: "2026-08-26",
            shiftCode: "A",
            revisionNumber: 0,
            structure: APPROVED_COUNT_SHEET_STRUCTURE,
            payload,
            updatedAt: null,
          },
        });
      });
    const user = userEvent.setup();
    render(<CountSheetWorkspace initialWorkDate="2026-08-26" shiftCode="A" />);
    await screen.findByText(/No saved sheet exists/);
    await user.type(screen.getByLabelText("In housing, 9"), "9");
    for (let i = 0; i < 2; i++) {
      await user.click(
        screen.getByRole("button", { name: "Save new revision" }),
      );
      await screen.findByText(/Save could not be confirmed/);
    }
    await user.type(screen.getByLabelText("In housing, 9"), "0");
    await user.click(screen.getByRole("button", { name: "Save new revision" }));
    await screen.findByText(/Save could not be confirmed/);
    const requests = fetchMock.mock.calls.filter(
      ([, init]) => init?.method === "POST",
    );
    expect(requests).toHaveLength(3);
    expect(requests[1][1]).toEqual(requests[0][1]);
    expect(requests[2][1]?.headers).not.toEqual(requests[0][1]?.headers);
    expect(
      JSON.parse(String(requests[2][1]?.body)).payload.in_housing["9"],
    ).toBe(90);
  });
  it("lets an officer clear and correct the date without locking the sheet or loading a partial date", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (url) =>
        Response.json({
          data: {
            recordId: null,
            workDate: new URL(String(url), "http://localhost").searchParams.get(
              "work_date",
            ),
            shiftCode: "A",
            revisionNumber: 0,
            structure: APPROVED_COUNT_SHEET_STRUCTURE,
            payload: createBlankCountPayload(APPROVED_COUNT_SHEET_STRUCTURE),
            updatedAt: null,
          },
        }),
      );
    const user = userEvent.setup();
    render(<CountSheetWorkspace initialWorkDate="2026-08-26" shiftCode="A" />);
    await screen.findByText(/No saved sheet exists/);
    const date = screen.getByLabelText("Work date");
    fireEvent.change(date, { target: { value: "" } });
    expect(date).toBeEnabled();
    expect(screen.getByRole("button", { name: "Load date" })).toBeDisabled();
    expect(screen.getByLabelText("In housing, 9")).toBeDisabled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await user.click(
      screen.getByRole("button", { name: "Cancel date change" }),
    );
    expect(date).toHaveValue("2026-08-26");
    expect(screen.getByLabelText("In housing, 9")).toBeEnabled();
    fireEvent.change(date, { target: { value: "2026-08-27" } });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole("button", { name: "Load date" }));
    await waitFor(() =>
      expect(screen.getByLabelText("In housing, 9")).toBeEnabled(),
    );
    expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/web/v1/count-sheets?work_date=2026-08-27",
      expect.any(Object),
    );
    expect(screen.getByText(/Loaded sheet: 2026-08-27/)).toBeVisible();
  });
  it("retains counts and offers separate-tab sign-in when the session expires", async () => {
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
            updatedAt: null,
          },
        }),
      )
      .mockResolvedValueOnce(
        Response.json({ error: "authentication_required" }, { status: 401 }),
      );
    const user = userEvent.setup();
    render(<CountSheetWorkspace initialWorkDate="2026-08-26" shiftCode="A" />);
    await screen.findByText(/No saved sheet exists for this date/);
    await user.type(
      screen.getByRole("textbox", { name: "In housing, 9" }),
      "9",
    );
    await user.click(screen.getByRole("button", { name: "Save new revision" }));
    expect(await screen.findByText(/Your session ended/)).toBeVisible();
    expect(screen.getByRole("textbox", { name: "In housing, 9" })).toHaveValue(
      "9",
    );
    expect(
      screen.getByRole("link", { name: "Sign in again (opens a new tab)" }),
    ).toHaveAttribute("target", "_blank");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
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
      screen.getByRole("region", { name: "North Central Unit Count Sheet" }),
    ).toHaveAttribute("aria-busy", "false");
    expect(screen.getByRole("status")).toHaveTextContent(
      /No saved sheet exists for this date.*Do not guess a number/i,
    );
    expect(
      screen.getByRole("region", {
        name: "Count entries by area and unit",
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
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    await user.click(
      screen.getByRole("button", {
        name: "Reload saved date (discard entries)",
      }),
    );
    expect(confirm).toHaveBeenCalledOnce();
    expect(screen.getByRole("textbox", { name: "In housing, 1" })).toHaveValue(
      "8",
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
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
    expect(screen.getByRole("status")).toHaveTextContent(
      /Recording the print request/i,
    );
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
