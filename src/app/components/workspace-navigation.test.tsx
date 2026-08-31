import { render, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { WorkspaceNavigation } from "./workspace-navigation";

describe("WorkspaceNavigation", () => {
  it("shows the officer tools and marks only the current page", () => {
    const view = render(<WorkspaceNavigation current="Policy" />);

    expect(
      within(view.container).getByRole("navigation", { name: "Workspace" }),
    ).toBeVisible();
    expect(
      within(view.container).getByRole("link", { name: "Home" }),
    ).toHaveAttribute("href", "/home");
    expect(
      within(view.container).getByRole("link", { name: "Reports" }),
    ).toHaveAttribute("href", "/reports");
    expect(
      within(view.container).getByRole("link", { name: "Policy" }),
    ).toHaveAttribute("aria-current", "page");
    expect(
      within(view.container).getByRole("link", { name: "Forms" }),
    ).toHaveAttribute("href", "/forms");
    expect(
      within(view.container).getByRole("link", { name: "Count Sheet" }),
    ).toHaveAttribute("href", "/count-sheet");
    expect(
      within(view.container).getByRole("link", { name: "Account" }),
    ).toHaveAttribute("href", "/account");
  });

  it("opens and closes the mobile menu without leaving it stuck open", async () => {
    const user = userEvent.setup();
    const view = render(<WorkspaceNavigation current="Home" />);

    const toggle = within(view.container).getByRole("button", { name: "Menu" });
    await user.click(toggle);

    expect(toggle).toHaveAccessibleName("Close menu");
    expect(toggle).toHaveAttribute("aria-expanded", "true");

    const dismiss = within(view.container).getByRole("button", {
      name: "Dismiss navigation menu",
    });
    expect(dismiss).toBeVisible();
    await user.click(dismiss);

    expect(toggle).toHaveAccessibleName("Menu");
    expect(toggle).toHaveAttribute("aria-expanded", "false");

    await user.click(toggle);
    await user.click(
      within(view.container).getByRole("link", { name: "Reports" }),
    );

    expect(toggle).toHaveAccessibleName("Menu");
    expect(toggle).toHaveAttribute("aria-expanded", "false");
  });
});
