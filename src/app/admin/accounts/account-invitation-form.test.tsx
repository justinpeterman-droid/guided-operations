import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({ refresh })),
}));

import { AccountInvitationForm } from "./account-invitation-form";

function response(body: unknown, ok = true): Response {
  return new Response(JSON.stringify(body), {
    status: ok ? 200 : 403,
    headers: { "Content-Type": "application/json" },
  });
}

describe("AccountInvitationForm", () => {
  afterEach(cleanup);

  beforeEach(() => {
    refresh.mockReset();
    vi.unstubAllGlobals();
  });

  it("gets the CSRF token, then a fresh approval, before creating the account", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(response({ csrfToken: "csrf-token" }))
      .mockResolvedValueOnce(
        response({ data: { requestId: "request-id", token: "proof-token" } }),
      )
      .mockResolvedValueOnce(
        response({
          data: {
            employeeNumberHint: "0002",
            temporaryPasscode: "OneTimePasscode",
            temporaryPasscodeExpiresAt: new Date(
              Date.now() + 60_000,
            ).toISOString(),
          },
        }),
      );
    vi.stubGlobal("fetch", fetch);
    const user = userEvent.setup();
    render(<AccountInvitationForm />);

    await user.type(screen.getByLabelText("Employee number"), "FIXTURE-0002");
    await user.type(screen.getByLabelText("Name"), "Fictional Officer");
    await user.selectOptions(screen.getByLabelText("Assigned shift"), "U");
    await user.type(
      screen.getByLabelText("Your administrator passcode"),
      "FreshPasscode9!",
    );
    await user.click(screen.getByRole("button", { name: "Create account" }));

    await screen.findByRole("heading", {
      name: "Give this passcode to employee ending 0002",
    });
    expect(screen.getByText("OneTimePasscode")).toBeInTheDocument();
    expect(fetch).toHaveBeenNthCalledWith(
      1,
      "/api/auth/csrf",
      expect.objectContaining({ credentials: "same-origin" }),
    );
    expect(fetch).toHaveBeenNthCalledWith(
      2,
      "/api/admin/account-create-step-up",
      expect.objectContaining({
        body: JSON.stringify({ passcode: "FreshPasscode9!" }),
      }),
    );
    expect(fetch).toHaveBeenNthCalledWith(
      3,
      "/api/admin/accounts",
      expect.objectContaining({
        body: JSON.stringify({
          employeeNumber: "FIXTURE-0002",
          displayName: "Fictional Officer",
          role: "officer",
          shiftCode: "U",
          requestId: "request-id",
          token: "proof-token",
        }),
      }),
    );
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("does not attempt account creation when the fresh administrator confirmation fails", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(response({ csrfToken: "csrf-token" }))
      .mockResolvedValueOnce(
        response({ error: "authentication_required" }, false),
      );
    vi.stubGlobal("fetch", fetch);
    const user = userEvent.setup();
    render(<AccountInvitationForm />);

    await user.type(screen.getByLabelText("Employee number"), "FIXTURE-0002");
    await user.type(screen.getByLabelText("Name"), "Fictional Officer");
    await user.type(
      screen.getByLabelText("Your administrator passcode"),
      "FreshPasscode9!",
    );
    await user.click(screen.getByRole("button", { name: "Create account" }));

    await waitFor(() =>
      expect(
        screen.getByText(/could not create that account/i),
      ).toBeInTheDocument(),
    );
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(refresh).not.toHaveBeenCalled();
  });

  it("never displays an expired temporary passcode", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(response({ csrfToken: "csrf-token" }))
      .mockResolvedValueOnce(
        response({ data: { requestId: "request-id", token: "proof-token" } }),
      )
      .mockResolvedValueOnce(
        response({
          data: {
            employeeNumberHint: "0002",
            temporaryPasscode: "ExpiredPasscode",
            temporaryPasscodeExpiresAt: "2000-01-01T00:00:00.000Z",
          },
        }),
      );
    vi.stubGlobal("fetch", fetch);
    const user = userEvent.setup();
    render(<AccountInvitationForm />);

    await user.type(screen.getByLabelText("Employee number"), "FIXTURE-0002");
    await user.type(screen.getByLabelText("Name"), "Fictional Officer");
    await user.type(
      screen.getByLabelText("Your administrator passcode"),
      "FreshPasscode9!",
    );
    await user.click(screen.getByRole("button", { name: "Create account" }));

    await screen.findByText(/temporary passcode has expired/i);
    expect(screen.queryByText("ExpiredPasscode")).not.toBeInTheDocument();
  });
});
