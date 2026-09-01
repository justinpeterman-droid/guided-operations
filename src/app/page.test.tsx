import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const redirect = vi.fn();

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    redirect(url);
    throw new Error(`Redirected to ${url}`);
  },
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn().mockResolvedValue({}),
}));

vi.mock("@/server/auth/current-session", () => ({
  authorizeCurrentSession: vi.fn(),
}));

import { authorizeCurrentSession } from "@/server/auth/current-session";

import PublicLandingPage from "./page";

describe("PublicLandingPage", () => {
  it("redirects signed-in officers to the workspace home", async () => {
    vi.mocked(authorizeCurrentSession).mockResolvedValue({
      allowed: true,
      account: {
        role: "officer",
        mustChangePasscode: false,
        shiftCode: "A",
      },
    } as never);

    await expect(PublicLandingPage()).rejects.toThrow("Redirected to /home");
    expect(redirect).toHaveBeenCalledWith("/home");
  });

  it("shows a working sign-in entry for signed-out visitors", async () => {
    redirect.mockReset();
    vi.mocked(authorizeCurrentSession).mockResolvedValue({
      allowed: false,
      reason: "missing_session",
    } as never);

    render(await PublicLandingPage());

    expect(redirect).not.toHaveBeenCalled();
    expect(screen.getByRole("link", { name: "Go to sign in" })).toHaveAttribute(
      "href",
      "/login",
    );
    expect(
      screen.getByRole("link", { name: "Sign in to Guided Operations" }),
    ).toHaveAttribute("href", "/login");
    expect(
      screen.getByRole("heading", {
        name: "Clear guidance for the work that has to be right.",
      }),
    ).toBeVisible();
  });
});
