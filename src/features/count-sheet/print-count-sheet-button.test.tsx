import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PrintCountSheetButton } from "./print-count-sheet-button";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("PrintCountSheetButton", () => {
  it("opens the browser print dialog only after an explicit training-preview action", async () => {
    const print = vi.spyOn(window, "print").mockImplementation(() => undefined);
    const user = userEvent.setup();
    render(<PrintCountSheetButton />);

    await user.click(
      screen.getByRole("button", { name: "Print training preview" }),
    );

    expect(print).toHaveBeenCalledOnce();
  });

  it("does not print an operational sheet while its parent marks it unsafe", async () => {
    const print = vi.spyOn(window, "print").mockImplementation(() => undefined);
    const user = userEvent.setup();
    render(<PrintCountSheetButton disabled label="Print saved sheet" />);

    await user.click(screen.getByRole("button", { name: "Print saved sheet" }));

    expect(print).not.toHaveBeenCalled();
  });

  it("opens an operational print dialog only after its protected audit succeeds", async () => {
    const print = vi.spyOn(window, "print").mockImplementation(() => undefined);
    const onBeforePrint = vi.fn().mockResolvedValue(true);
    const user = userEvent.setup();
    render(
      <PrintCountSheetButton
        label="Print saved sheet"
        onBeforePrint={onBeforePrint}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Print saved sheet" }));

    expect(onBeforePrint).toHaveBeenCalledOnce();
    expect(print).toHaveBeenCalledOnce();
  });

  it("does not print when the protected audit cannot be recorded", async () => {
    const print = vi.spyOn(window, "print").mockImplementation(() => undefined);
    const user = userEvent.setup();
    render(
      <PrintCountSheetButton
        label="Print saved sheet"
        onBeforePrint={vi.fn().mockResolvedValue(false)}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Print saved sheet" }));

    expect(print).not.toHaveBeenCalled();
  });
});
