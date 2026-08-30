import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({ refresh })),
}));

import { AccountRoleChangeControl } from "./account-role-change-control";

function response(body: unknown, ok = true): Response {
  return new Response(JSON.stringify(body), {
    status: ok ? 200 : 403,
    headers: { "Content-Type": "application/json" },
  });
}

describe("AccountRoleChangeControl", () => {
  beforeEach(() => {
    refresh.mockReset();
    vi.unstubAllGlobals();
  });

  it("gets CSRF and fresh approval before promoting an officer", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(response({ csrfToken: "csrf-token" }))
      .mockResolvedValueOnce(
        response({ data: { requestId: "request-id", token: "proof-token" } }),
      )
      .mockResolvedValueOnce(
        response({ data: { status: "changed", role: "administrator" } }),
      );
    vi.stubGlobal("fetch", fetch);
    const user = userEvent.setup();
    render(
      <AccountRoleChangeControl
        accountId="11111111-1111-4111-8111-111111111111"
        currentRole="officer"
        displayName="Fictional Officer"
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "Make administrator" }),
    );
    await user.type(
      screen.getByLabelText("Your administrator passcode"),
      "FreshPasscode9!",
    );
    await user.click(
      screen.getByRole("button", { name: "Confirm: Make administrator" }),
    );

    expect(await screen.findByText("Role changed")).toBeInTheDocument();
    expect(fetch).toHaveBeenNthCalledWith(
      2,
      "/api/admin/account-change-role-step-up",
      expect.objectContaining({
        body: JSON.stringify({ passcode: "FreshPasscode9!" }),
      }),
    );
    expect(fetch).toHaveBeenNthCalledWith(
      3,
      "/api/admin/accounts/11111111-1111-4111-8111-111111111111/change-role",
      expect.objectContaining({
        body: JSON.stringify({
          requestId: "request-id",
          token: "proof-token",
          newRole: "administrator",
        }),
      }),
    );
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("offers to demote an administrator to officer", () => {
    render(
      <AccountRoleChangeControl
        accountId="11111111-1111-4111-8111-111111111111"
        currentRole="administrator"
        displayName="Fictional Administrator"
      />,
    );

    expect(
      screen.getByRole("button", { name: "Make officer" }),
    ).toBeInTheDocument();
  });
});
