import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PrintReportButton } from "./print-report-button";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("PrintReportButton", () => {
  it("starts printing only after the protected current-revision audit succeeds", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        Response.json({ csrfToken: "fictional-csrf-token" }),
      )
      .mockResolvedValueOnce(
        Response.json({ data: { recorded: true } }, { status: 201 }),
      );
    vi.spyOn(crypto, "randomUUID").mockReturnValue(
      "22222222-2222-4222-8222-222222222222",
    );
    const print = vi.spyOn(window, "print").mockImplementation(() => undefined);
    const user = userEvent.setup();
    render(
      <PrintReportButton
        reportId="11111111-1111-4111-8111-111111111111"
        revisionNumber={3}
      />,
    );
    await user.click(
      screen.getByRole("button", { name: "Print current report" }),
    );
    expect(
      await screen.findByText(/Print request recorded.*Opening the browser/),
    ).toBeVisible();
    expect(print).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/auth/csrf", {
      cache: "no-store",
      credentials: "same-origin",
    });
    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      "/api/web/v1/reports/11111111-1111-4111-8111-111111111111/print",
    );
    expect(JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body))).toEqual({
      revisionNumber: 3,
    });
  });

  it("does not print when the audit is unavailable", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        Response.json({ csrfToken: "fictional-csrf-token" }),
      )
      .mockResolvedValueOnce(Response.json({}, { status: 503 }));
    const print = vi.spyOn(window, "print").mockImplementation(() => undefined);
    const user = userEvent.setup();
    render(
      <PrintReportButton
        reportId="11111111-1111-4111-8111-111111111111"
        revisionNumber={3}
      />,
    );
    await user.click(
      screen.getByRole("button", { name: "Print current report" }),
    );
    expect(
      await screen.findByText(/could not be recorded.*no print dialog/),
    ).toBeVisible();
    expect(print).not.toHaveBeenCalled();
  });
});
