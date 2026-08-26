import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));

import { ReportFinalizationForm } from "./report-finalization-form";

describe("ReportFinalizationForm", () => {
  it("requires officer attestation and sends the edited narrative through the protected finalization endpoint", async () => {
    const fetch = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ csrfToken: "csrf-token" }), {
          status: 200,
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: { reportId: "11111111-1111-4111-8111-111111111111" },
          }),
          { status: 201 },
        ),
      );
    vi.spyOn(globalThis.crypto, "randomUUID").mockReturnValue("a".repeat(32));
    const user = userEvent.setup();
    render(
      <ReportFinalizationForm
        candidateId="22222222-2222-4222-8222-222222222222"
        initialNarrative="Fictional draft text."
      />,
    );

    expect(
      screen.getByRole("button", { name: "Create final report" }),
    ).toBeDisabled();
    await user.clear(screen.getByLabelText("Final narrative"));
    await user.type(
      screen.getByLabelText("Final narrative"),
      "Officer-edited final narrative.",
    );
    await user.click(
      screen.getByRole("checkbox", {
        name: /I reviewed this narrative and am submitting it as my own final report/i,
      }),
    );
    await user.click(
      screen.getByRole("button", { name: "Create final report" }),
    );

    expect(fetch).toHaveBeenNthCalledWith(1, "/api/auth/csrf", {
      credentials: "same-origin",
    });
    expect(fetch).toHaveBeenNthCalledWith(
      2,
      "/api/web/v1/report-drafts/22222222-2222-4222-8222-222222222222/finalize",
      expect.objectContaining({ method: "POST", credentials: "same-origin" }),
    );
    expect(replace).toHaveBeenCalledWith(
      "/reports/11111111-1111-4111-8111-111111111111",
    );
  });
});
