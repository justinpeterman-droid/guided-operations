import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { PrintCountSheetButton } from "./print-count-sheet-button";

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
});
