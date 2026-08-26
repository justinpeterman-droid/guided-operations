import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { NewIncidentWorkspace } from "./new-incident-workspace";

describe("NewIncidentWorkspace", () => {
  it("keeps missing information explicit through review before a protected save", async () => {
    const fetch = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ csrfToken: "csrf-token" }), {
          status: 200,
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: {} }), { status: 201 }),
      );
    vi.spyOn(globalThis.crypto, "randomUUID").mockReturnValue("a".repeat(32));
    const user = userEvent.setup();
    render(<NewIncidentWorkspace />);

    await user.type(screen.getByLabelText("Incident number"), "FICTIONAL-101");
    await user.type(
      screen.getByLabelText("Incident name"),
      "Training scenario",
    );
    await user.type(screen.getByLabelText("Category"), "training");
    await user.type(
      screen.getByLabelText("Your field notes"),
      "Fictional observed note.",
    );
    await user.click(
      screen.getByRole("button", { name: "Continue to fact review" }),
    );
    await user.type(
      screen.getByLabelText("Confirmed fact"),
      "Fictional fact supported by notes.",
    );
    await user.type(
      screen.getByLabelText("Information not yet known"),
      "Fictional missing detail.",
    );
    await user.click(screen.getByRole("button", { name: "Review incident" }));

    expect(screen.getByText("Fictional missing detail.")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Save incident" }));

    expect(fetch).toHaveBeenNthCalledWith(1, "/api/auth/csrf", {
      credentials: "same-origin",
    });
    expect(fetch).toHaveBeenNthCalledWith(
      2,
      "/api/web/v1/incidents",
      expect.objectContaining({ method: "POST", credentials: "same-origin" }),
    );
    expect(await screen.findByText(/Incident saved/)).toBeVisible();
  });
});
