import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PreviewShell } from "./preview-shell";

describe("PreviewShell", () => {
  it("renders GuidedMark branding and the fictional preview badge", () => {
    render(
      <PreviewShell title="Forms Library">
        <p>Preview body</p>
      </PreviewShell>,
    );

    expect(
      screen.getByRole("link", { name: /Guided Operations/i }),
    ).toHaveAttribute("href", "/preview/workspace");
    expect(screen.getByText("Fictional training preview")).toBeVisible();
    expect(screen.getByText("Preview body")).toBeVisible();
  });
});
