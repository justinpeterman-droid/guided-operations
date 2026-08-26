import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({ refresh })),
}));

import { AccountShiftChangeControl } from "./account-shift-change-control";

function response(body: unknown): Response {
  return Response.json(body);
}

describe("AccountShiftChangeControl", () => {
  beforeEach(() => {
    refresh.mockReset();
    vi.unstubAllGlobals();
  });

  it("gets CSRF and a shift-only approval before changing the roster", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(response({ csrfToken: "csrf-token" }))
      .mockResolvedValueOnce(
        response({ data: { requestId: "request-id", token: "proof-token" } }),
      )
      .mockResolvedValueOnce(
        response({ data: { status: "changed", shiftCode: "U" } }),
      );
    vi.stubGlobal("fetch", fetch);
    const user = userEvent.setup();
    render(
      <AccountShiftChangeControl
        accountId="11111111-1111-4111-8111-111111111111"
        currentShiftCode="A"
        displayName="Fictional Officer"
      />,
    );

    await user.click(screen.getByRole("button", { name: "Change shift" }));
    await user.selectOptions(screen.getByLabelText("New assigned shift"), "U");
    await user.type(
      screen.getByLabelText("Your administrator passcode"),
      "FreshPasscode9!",
    );
    await user.click(
      screen.getByRole("button", { name: "Confirm shift change" }),
    );

    expect(await screen.findByText("Shift changed")).toBeInTheDocument();
    expect(fetch).toHaveBeenNthCalledWith(
      2,
      "/api/admin/account-change-shift-step-up",
      expect.objectContaining({
        body: JSON.stringify({ passcode: "FreshPasscode9!" }),
      }),
    );
    expect(fetch).toHaveBeenNthCalledWith(
      3,
      "/api/admin/accounts/11111111-1111-4111-8111-111111111111/change-shift",
      expect.objectContaining({
        body: JSON.stringify({
          requestId: "request-id",
          token: "proof-token",
          newShiftCode: "U",
        }),
      }),
    );
    expect(refresh).toHaveBeenCalledOnce();
  });
});
