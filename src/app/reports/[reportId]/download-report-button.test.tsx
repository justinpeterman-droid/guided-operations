import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DownloadReportButton } from "./download-report-button";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("DownloadReportButton", () => {
  it("downloads the explicitly selected revision after protected output succeeds", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        Response.json({ csrfToken: "fictional-csrf-token" }),
      )
      .mockResolvedValueOnce(
        new Response(new Blob(["fictional-docx"]), {
          status: 200,
          headers: {
            "content-type":
              "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "x-report-revision": "2",
          },
        }),
      );
    vi.spyOn(crypto, "randomUUID").mockReturnValue(
      "22222222-2222-4222-8222-222222222222",
    );
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:fictional-docx");
    const revoke = vi
      .spyOn(URL, "revokeObjectURL")
      .mockImplementation(() => {});
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});
    const user = userEvent.setup();
    render(
      <DownloadReportButton
        reportId="11111111-1111-4111-8111-111111111111"
        revisionNumber={2}
      />,
    );
    await user.click(
      screen.getByRole("button", { name: "Download this version" }),
    );
    expect(
      await screen.findByText("Downloaded report revision 2."),
    ).toBeVisible();
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/web/v1/reports/11111111-1111-4111-8111-111111111111/export-docx?revision=2",
      expect.objectContaining({ method: "POST" }),
    );
    expect(fetchMock.mock.calls[1]?.[1]).not.toHaveProperty("body");
    expect(click).toHaveBeenCalledOnce();
    expect(revoke).toHaveBeenCalledWith("blob:fictional-docx");
  });

  it("creates no file when protected output fails", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        Response.json({ csrfToken: "fictional-csrf-token" }),
      )
      .mockResolvedValueOnce(Response.json({}, { status: 403 }));
    const createObjectUrl = vi.spyOn(URL, "createObjectURL");
    const user = userEvent.setup();
    render(
      <DownloadReportButton
        current
        reportId="11111111-1111-4111-8111-111111111111"
        revisionNumber={2}
      />,
    );
    await user.click(
      screen.getByRole("button", { name: "Download current Word file" }),
    );
    expect(
      await screen.findByText(/Word file could not be prepared/),
    ).toBeVisible();
    expect(createObjectUrl).not.toHaveBeenCalled();
  });
});
