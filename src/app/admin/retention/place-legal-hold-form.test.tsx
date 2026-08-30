import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({ refresh })),
}));

import { PlaceLegalHoldForm } from "./place-legal-hold-form";

function response(body: unknown, ok = true): Response {
  return new Response(JSON.stringify(body), {
    status: ok ? 200 : 403,
    headers: { "Content-Type": "application/json" },
  });
}

describe("PlaceLegalHoldForm", () => {
  beforeEach(() => {
    refresh.mockReset();
    vi.unstubAllGlobals();
  });

  it("gets placement-specific approval before creating a hold", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(response({ csrfToken: "csrf-token" }))
      .mockResolvedValueOnce(
        response({ data: { requestId: "request-id", token: "proof-token" } }),
      )
      .mockResolvedValueOnce(
        response({ data: { status: "placed", holdId: "hold-id" } }),
      );
    vi.stubGlobal("fetch", fetch);
    const user = userEvent.setup();
    render(<PlaceLegalHoldForm />);

    await user.selectOptions(screen.getByLabelText("Record type"), "incident");
    await user.type(
      screen.getByLabelText("Target record ID"),
      "22222222-2222-4222-8222-222222222222",
    );
    await user.type(
      screen.getByLabelText("Authority reference"),
      "FICTIONAL-HOLD-001",
    );
    await user.type(
      screen.getByLabelText("Your administrator passcode"),
      "FreshPasscode9!",
    );
    await user.click(
      screen.getByRole("button", { name: "Confirm legal hold" }),
    );

    expect(
      await screen.findByText("The legal hold was placed and recorded."),
    ).toBeInTheDocument();
    expect(fetch).toHaveBeenNthCalledWith(
      2,
      "/api/admin/legal-hold-step-up",
      expect.objectContaining({
        body: JSON.stringify({
          action: "place",
          passcode: "FreshPasscode9!",
        }),
      }),
    );
    expect(fetch).toHaveBeenNthCalledWith(
      3,
      "/api/admin/legal-holds",
      expect.objectContaining({
        body: JSON.stringify({
          requestId: "request-id",
          token: "proof-token",
          scopeType: "incident",
          scopeId: "22222222-2222-4222-8222-222222222222",
          authorityReference: "FICTIONAL-HOLD-001",
        }),
      }),
    );
    expect(refresh).toHaveBeenCalledOnce();
  });
});
