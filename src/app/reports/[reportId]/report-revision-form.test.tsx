import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

import { ReportRevisionForm } from "./report-revision-form";

describe("ReportRevisionForm", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    refresh.mockClear();
  });

  it("sends a corrected immutable revision through the protected endpoint", async () => {
    const fetch = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ csrfToken: "csrf-token" }), {
          status: 200,
        }),
      )
      .mockResolvedValueOnce(new Response("", { status: 201 }));
    vi.spyOn(globalThis.crypto, "randomUUID").mockReturnValue("a".repeat(32));
    const user = userEvent.setup();
    render(
      <ReportRevisionForm
        initialNarrative="Fictional report text."
        reportId="11111111-1111-4111-8111-111111111111"
        revisionNumber={1}
      />,
    );

    await user.type(screen.getByLabelText("Correction reason"), "Typo fixed.");
    await user.click(
      screen.getByRole("button", { name: "Create corrected revision" }),
    );

    expect(fetch).toHaveBeenNthCalledWith(
      2,
      "/api/web/v1/reports/11111111-1111-4111-8111-111111111111/revisions",
      expect.objectContaining({
        method: "POST",
        credentials: "same-origin",
        body: JSON.stringify({
          baseRevisionNumber: 1,
          narrative: "Fictional report text.",
          reason: "Typo fixed.",
        }),
      }),
    );
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("keeps the correction visible when a newer revision already exists", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ csrfToken: "csrf-token" }), {
          status: 200,
        }),
      )
      .mockResolvedValueOnce(new Response("", { status: 409 }));
    vi.spyOn(globalThis.crypto, "randomUUID").mockReturnValue("a".repeat(32));
    const user = userEvent.setup();
    render(
      <ReportRevisionForm
        initialNarrative="Fictional report text."
        reportId="11111111-1111-4111-8111-111111111111"
        revisionNumber={1}
      />,
    );

    await user.type(screen.getByLabelText("Correction reason"), "Typo fixed.");
    await user.click(
      screen.getByRole("button", { name: "Create corrected revision" }),
    );

    expect(screen.getByText(/newer revision was saved/i)).toBeVisible();
    expect(screen.getByLabelText("Correction reason")).toHaveValue(
      "Typo fixed.",
    );
  });
});
