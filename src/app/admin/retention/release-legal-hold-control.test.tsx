import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({ refresh })),
}));

import { ReleaseLegalHoldControl } from "./release-legal-hold-control";

function response(body: unknown, ok = true): Response {
  return new Response(JSON.stringify(body), {
    status: ok ? 200 : 403,
    headers: { "Content-Type": "application/json" },
  });
}

describe("ReleaseLegalHoldControl", () => {
  beforeEach(() => {
    refresh.mockReset();
    vi.unstubAllGlobals();
  });

  it("gets release-specific approval before releasing a hold", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(response({ csrfToken: "csrf-token" }))
      .mockResolvedValueOnce(
        response({ data: { requestId: "request-id", token: "proof-token" } }),
      )
      .mockResolvedValueOnce(response({ data: { status: "released" } }));
    vi.stubGlobal("fetch", fetch);
    const user = userEvent.setup();
    const holdId = "11111111-1111-4111-8111-111111111111";
    render(<ReleaseLegalHoldControl holdId={holdId} />);

    await user.click(screen.getByRole("button", { name: "Release hold" }));
    const authorityReference = screen.getByLabelText(
      "Release authority reference",
    );
    const authorityPattern = authorityReference.getAttribute("pattern");
    expect(authorityPattern).not.toBeNull();
    expect(() => new RegExp(authorityPattern!, "v")).not.toThrow();
    await user.type(authorityReference, "FICTIONAL-RELEASE-001");
    await user.type(
      screen.getByLabelText("Your administrator passcode"),
      "FreshPasscode9!",
    );
    await user.click(screen.getByRole("button", { name: "Confirm release" }));

    expect(await screen.findByText("Hold released")).toBeInTheDocument();
    expect(fetch).toHaveBeenNthCalledWith(
      2,
      "/api/admin/legal-hold-step-up",
      expect.objectContaining({
        body: JSON.stringify({
          action: "release",
          passcode: "FreshPasscode9!",
        }),
      }),
    );
    expect(fetch).toHaveBeenNthCalledWith(
      3,
      `/api/admin/legal-holds/${holdId}/release`,
      expect.objectContaining({
        body: JSON.stringify({
          requestId: "request-id",
          token: "proof-token",
          authorityReference: "FICTIONAL-RELEASE-001",
        }),
      }),
    );
    expect(refresh).toHaveBeenCalledOnce();
  });
});
