import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const replace = vi.fn();
const refresh = vi.fn();

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, refresh }) }));

import { TemporaryPasscodeChangeForm } from "./temporary-passcode-change-form";

afterEach(() => {
  cleanup();
  replace.mockReset();
  refresh.mockReset();
  vi.unstubAllGlobals();
});

describe("TemporaryPasscodeChangeForm", () => {
  it("uses a fresh CSRF token and never sends the employee number in a URL", async () => {
    const user = userEvent.setup();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ csrfToken: "fictional-token" }))
      .mockResolvedValueOnce(
        Response.json({ data: { status: "passcode_changed" } }),
      );
    vi.stubGlobal("fetch", fetchMock);
    render(<TemporaryPasscodeChangeForm />);

    await user.type(screen.getByLabelText("Confirm employee number"), "EMP-42");
    await user.type(screen.getByLabelText("New personal passcode"), "Cedar7!9");
    await user.click(screen.getByRole("button", { name: "Change passcode" }));

    expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/auth/csrf", {
      credentials: "same-origin",
    });
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/auth/complete-temporary-passcode-change",
      expect.objectContaining({
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": "fictional-token",
        },
        body: JSON.stringify({
          employeeNumber: "EMP-42",
          passcode: "Cedar7!9",
        }),
      }),
    );
    expect(replace).toHaveBeenCalledWith("/login");
  });
});
