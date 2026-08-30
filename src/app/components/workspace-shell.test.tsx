import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { WorkspaceShell } from "./workspace-shell";

describe("WorkspaceShell", () => {
  it("renders the shared brand, navigation, and page content", () => {
    render(
      <WorkspaceShell current="Reports" title="Reports">
        <p>Authorized report list</p>
      </WorkspaceShell>,
    );

    expect(
      screen.getByRole("link", { name: /Guided Operations/i }),
    ).toHaveAttribute("href", "/home");
    expect(screen.getByRole("navigation", { name: "Workspace" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Reports" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByText("Authorized report list")).toBeVisible();
  });
});
