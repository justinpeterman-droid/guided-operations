import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const replace = vi.fn();
const refresh = vi.fn();

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, refresh }) }));

import { AccountSessionControls } from "./account-session-controls";

afterEach(() => {
  cleanup();
  replace.mockReset();
  refresh.mockReset();
  vi.unstubAllGlobals();
});

function csrfResponse() {
  return Response.json({ csrfToken: "fictional-session-bound-token" });
}

describe("AccountSessionControls", () => {
  it("uses a fresh CSRF token to sign out only this browser", async () => {
    const user = userEvent.setup();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(csrfResponse())
      .mockResolvedValueOnce(Response.json({ data: { status: "signed_out" } }));
    vi.stubGlobal("fetch", fetchMock);
    render(<AccountSessionControls />);

    await user.click(
      screen.getByRole("button", { name: "Sign out of this browser" }),
    );

    expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/auth/csrf", {
      credentials: "same-origin",
    });
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/auth/sign-out", {
      method: "POST",
      credentials: "same-origin",
      headers: { "X-CSRF-Token": "fictional-session-bound-token" },
    });
    expect(replace).toHaveBeenCalledWith("/login");
  });

  it("requires a visible confirmation before account-wide sign-out", async () => {
    const user = userEvent.setup();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(csrfResponse())
      .mockResolvedValueOnce(
        Response.json({ data: { status: "signed_out_everywhere" } }),
      );
    vi.stubGlobal("fetch", fetchMock);
    render(<AccountSessionControls />);

    await user.click(
      screen.getByRole("button", { name: "Sign out everywhere" }),
    );

    expect(fetchMock).not.toHaveBeenCalled();
    await user.click(
      screen.getByRole("button", { name: "Confirm sign out everywhere" }),
    );

    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/auth/sign-out-all", {
      method: "POST",
      credentials: "same-origin",
      headers: { "X-CSRF-Token": "fictional-session-bound-token" },
    });
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("keeps the person on the page when session revocation is unavailable", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 503 })),
    );
    render(<AccountSessionControls />);

    await user.click(
      screen.getByRole("button", { name: "Sign out of this browser" }),
    );

    expect(
      await screen.findByText(
        "We could not update your sessions. Please try again.",
      ),
    ).toBeVisible();
    expect(replace).not.toHaveBeenCalled();
  });
});
