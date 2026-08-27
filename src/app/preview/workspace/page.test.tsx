import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import WorkspacePreviewPage from "./page";

describe("WorkspacePreviewPage", () => {
  it("labels the command-center layout as a fictional training preview", () => {
    render(<WorkspacePreviewPage />);

    expect(screen.getByText("Fictional training preview")).toBeVisible();
    expect(
      screen.getByText("You review before anything becomes official."),
    ).toBeVisible();
    expect(
      screen.getByRole("link", { name: /View administrator layout/ }),
    ).toHaveAttribute("href", "/preview/admin");
  });
});
