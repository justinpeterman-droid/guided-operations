import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { PrintReportButton } from "./print-report-button";

describe("PrintReportButton", () => {
  it("starts the browser print dialog only after an explicit officer action", async () => {
    const print = vi.spyOn(window, "print").mockImplementation(() => undefined);
    const user = userEvent.setup();
    render(<PrintReportButton />);
    await user.click(
      screen.getByRole("button", { name: "Print current report" }),
    );
    expect(print).toHaveBeenCalledOnce();
  });
});
