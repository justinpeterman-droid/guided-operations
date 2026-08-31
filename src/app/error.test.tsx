import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import RootError from "./error";

describe("RootError", () => {
  it("keeps the shared recovery message and retry action available", async () => {
    const reset = vi.fn();
    const user = userEvent.setup();

    render(
      <RootError error={new Error("fictional render failure")} reset={reset} />,
    );

    expect(
      screen.getByRole("heading", {
        name: "This page cannot load right now.",
      }),
    ).toBeVisible();
    expect(screen.getByRole("link", { name: "Return home" })).toHaveAttribute(
      "href",
      "/home",
    );
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(reset).toHaveBeenCalledOnce();
  });
});
