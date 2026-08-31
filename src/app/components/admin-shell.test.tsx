import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AdminShell } from "./admin-shell";

describe("AdminShell", () => {
  it("renders the administrator brand link and officer navigation", () => {
    render(
      <AdminShell title="Accounts">
        <p>Protected roster</p>
      </AdminShell>,
    );

    expect(
      screen.getByRole("link", { name: /Guided Operations/i }),
    ).toHaveAttribute("href", "/admin");
    expect(screen.getByRole("navigation", { name: "Workspace" })).toBeVisible();
    expect(screen.getByText("Protected roster")).toBeVisible();
    expect(
      screen.getByRole("link", { name: "Administrator home" }),
    ).toHaveAttribute("href", "/admin");
  });
});
