import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();

vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

import { LoginForm } from "./login-form";

afterEach(() => {
  cleanup();
  push.mockReset();
  vi.unstubAllGlobals();
});

describe("LoginForm", () => {
  it("sends only the entered credentials to the guarded same-origin endpoint", async () => {
    const user = userEvent.setup();
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    render(<LoginForm />);

    await user.type(screen.getByLabelText("Employee number"), "Fictional-001");
    await user.type(screen.getByLabelText("Passcode"), "not-a-real-passcode");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(fetchMock).toHaveBeenCalledWith("/api/auth/sign-in", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        employeeNumber: "Fictional-001",
        passcode: "not-a-real-passcode",
      }),
    });
    expect(push).toHaveBeenCalledWith("/reports");
  });

  it("shows one generic failure message for a disabled or failed sign-in", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 404 })),
    );
    render(<LoginForm />);

    await user.type(screen.getByLabelText("Employee number"), "Fictional-001");
    await user.type(screen.getByLabelText("Passcode"), "not-a-real-passcode");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(
      await screen.findByText(
        "We could not sign you in. Check your employee number and passcode, then try again.",
      ),
    ).toBeVisible();
    expect(push).not.toHaveBeenCalled();
  });
});
