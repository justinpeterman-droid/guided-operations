import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { WorkspaceNavigation } from "./workspace-navigation";

describe("WorkspaceNavigation", () => {
  it("shows the officer tools and marks only the current page", () => {
    render(<WorkspaceNavigation current="Policy" />);

    expect(screen.getByRole("navigation", { name: "Workspace" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute(
      "href",
      "/home",
    );
    expect(screen.getByRole("link", { name: "Reports" })).toHaveAttribute(
      "href",
      "/reports",
    );
    expect(screen.getByRole("link", { name: "Policy" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Forms" })).toHaveAttribute(
      "href",
      "/preview/forms-library",
    );
    expect(screen.getByRole("link", { name: "Count Sheet" })).toHaveAttribute(
      "href",
      "/count-sheet",
    );
    expect(screen.getByRole("link", { name: "Account" })).toHaveAttribute(
      "href",
      "/account",
    );
  });
});
