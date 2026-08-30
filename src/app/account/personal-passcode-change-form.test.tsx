import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const replace = vi.fn();
const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, refresh }),
}));

import { PersonalPasscodeChangeForm } from "./personal-passcode-change-form";

afterEach(cleanup);

describe("PersonalPasscodeChangeForm", () => {
  beforeEach(() => {
    replace.mockReset();
    refresh.mockReset();
    vi.unstubAllGlobals();
  });

  it("sends the credentials only in a protected same-origin request", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ csrfToken: "fictional-token" }))
      .mockResolvedValueOnce(
        Response.json({ data: { status: "passcode_changed" } }),
      );
    vi.stubGlobal("fetch", fetch);
    const user = userEvent.setup();
    render(<PersonalPasscodeChangeForm />);

    await user.type(screen.getByLabelText("Confirm employee number"), "EMP-42");
    await user.type(screen.getByLabelText("Current passcode"), "Current9!");
    await user.type(screen.getByLabelText("New personal passcode"), "Cedar7!9");
    await user.type(screen.getByLabelText("Confirm new passcode"), "Cedar7!9");
    await user.click(screen.getByRole("button", { name: "Change passcode" }));

    expect(fetch).toHaveBeenNthCalledWith(
      2,
      "/api/auth/change-passcode",
      expect.objectContaining({
        body: JSON.stringify({
          employeeNumber: "EMP-42",
          currentPasscode: "Current9!",
          newPasscode: "Cedar7!9",
        }),
      }),
    );
    expect(replace).toHaveBeenCalledWith("/login");
  });

  it("does not send mismatched new passcodes", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const user = userEvent.setup();
    render(<PersonalPasscodeChangeForm />);

    await user.type(screen.getByLabelText("Confirm employee number"), "EMP-42");
    await user.type(screen.getByLabelText("Current passcode"), "Current9!");
    await user.type(screen.getByLabelText("New personal passcode"), "Cedar7!9");
    await user.type(screen.getByLabelText("Confirm new passcode"), "Maple8!2");
    await user.click(screen.getByRole("button", { name: "Change passcode" }));

    expect(fetch).not.toHaveBeenCalled();
    expect(screen.getByText(/could not be changed/i)).toBeInTheDocument();
  });
});
