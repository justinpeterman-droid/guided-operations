import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

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

  it("uses the same recovery surface for a bounded retry action", async () => {
    const onRetry = vi.fn();
    const user = userEvent.setup();
    render(
      <WorkspaceMessage
        actions={[{ label: "Try again", onClick: onRetry }]}
        description="Your work is still visible."
        eyebrow="Workspace unavailable"
        title="This page cannot load right now."
      />,
    );

    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});
