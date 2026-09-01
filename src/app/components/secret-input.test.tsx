import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { SecretInput } from "./secret-input";

afterEach(cleanup);

describe("SecretInput", () => {
  it("starts masked and lets keyboard users reveal and hide the value", async () => {
    const user = userEvent.setup();
    render(
      <SecretInput
        aria-label="Passcode"
        id="passcode"
        name="passcode"
        revealLabel="passcode"
      />,
    );

    const input = screen.getByLabelText("Passcode");
    const toggle = screen.getByRole("button", { name: "Show passcode" });

    expect(input).toHaveAttribute("type", "password");
    expect(toggle).toHaveAttribute("aria-pressed", "false");

    await user.click(toggle);

    expect(input).toHaveAttribute("type", "text");
    expect(
      screen.getByRole("button", { name: "Hide passcode" }),
    ).toHaveAttribute("aria-pressed", "true");

    await user.keyboard("{Enter}");
    expect(input).toHaveAttribute("type", "password");
  });

  it("disables the reveal control with the protected field", () => {
    render(
      <SecretInput
        aria-label="Administrator passcode"
        disabled
        id="admin-passcode"
        revealLabel="administrator passcode"
      />,
    );

    expect(screen.getByLabelText("Administrator passcode")).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Show administrator passcode" }),
    ).toBeDisabled();
  });
});
