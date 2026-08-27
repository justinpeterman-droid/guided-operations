import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { PolicyTrainingPreview } from "./policy-training-preview";

describe("PolicyTrainingPreview", () => {
  it("changes only local fictional training guidance", async () => {
    const user = userEvent.setup();
    render(<PolicyTrainingPreview />);

    expect(
      screen.getByText(
        "No approved policy source is connected to this training preview.",
      ),
    ).toBeVisible();

    await user.click(
      screen.getByRole("button", {
        name: "What happens when the source is missing?",
      }),
    );

    expect(
      screen.getByText(
        /must return approved source passages or say that evidence is unavailable/i,
      ),
    ).toBeVisible();
    expect(
      screen.getByRole("button", {
        name: "What happens when the source is missing?",
      }),
    ).toHaveAttribute("aria-pressed", "true");
  });
});
