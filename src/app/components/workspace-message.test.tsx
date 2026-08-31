import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  HOME_ACTION,
  SIGN_IN_ACTION,
  WorkspaceMessage,
} from "./workspace-message";

describe("WorkspaceMessage", () => {
  it("renders brand, copy, and recovery actions", () => {
    render(
      <WorkspaceMessage
        actions={[SIGN_IN_ACTION, HOME_ACTION]}
        description="Reports are available only after sign-in."
        eyebrow="Private workspace"
        title="Sign in to view reports."
      />,
    );

    expect(
      screen.getByRole("link", { name: /Guided Operations/i }),
    ).toHaveAttribute("href", "/home");
    expect(
      screen.getByRole("heading", { name: "Sign in to view reports." }),
    ).toBeVisible();
    expect(screen.getByRole("link", { name: "Go to sign in" })).toHaveAttribute(
      "href",
      "/login",
    );
    expect(screen.getByRole("link", { name: "Return home" })).toHaveAttribute(
      "href",
      "/home",
    );
  });
});
