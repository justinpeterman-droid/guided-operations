import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const { redirectToLogin } = vi.hoisted(() => ({ redirectToLogin: vi.fn() }));

vi.mock("@/lib/navigation/full-login-redirect", () => ({ redirectToLogin }));

import { SignOutButton } from "./sign-out-button";

afterEach(() => {
  cleanup();
  redirectToLogin.mockReset();
  vi.unstubAllGlobals();
});

describe("SignOutButton", () => {
  it("obtains a fresh CSRF token before ending the local browser session", async () => {
    const user = userEvent.setup();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({ csrfToken: "fictional-session-bound-token" }),
      )
      .mockResolvedValueOnce(Response.json({ data: { status: "signed_out" } }));
    vi.stubGlobal("fetch", fetchMock);
    render(<SignOutButton />);

    await user.click(screen.getByRole("button", { name: "Sign out" }));

    expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/auth/csrf", {
      credentials: "same-origin",
    });
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/auth/sign-out", {
      method: "POST",
      credentials: "same-origin",
      headers: { "X-CSRF-Token": "fictional-session-bound-token" },
    });
    expect(redirectToLogin).toHaveBeenCalledOnce();
  });

  it("keeps the user on the page with a safe error when sign-out fails", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 503 })),
    );
    render(<SignOutButton />);

    await user.click(screen.getByRole("button", { name: "Sign out" }));

    expect(
      await screen.findByText("We could not sign you out. Please try again."),
    ).toBeVisible();
    expect(redirectToLogin).not.toHaveBeenCalled();
  });
});
