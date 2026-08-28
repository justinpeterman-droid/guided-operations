import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(),
}));
vi.mock("@/server/auth/current-session", () => ({
  authorizeCurrentSession: vi.fn(),
}));

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { authorizeCurrentSession } from "@/server/auth/current-session";

import FormsPage, { loadFormsAccess } from "./page";

describe("loadFormsAccess", () => {
  beforeEach(() => vi.clearAllMocks());

  it("keeps the real Forms Library behind a verified current session", async () => {
    const client = {};
    vi.mocked(createSupabaseServerClient).mockResolvedValue(client as never);
    vi.mocked(authorizeCurrentSession).mockResolvedValue({
      allowed: false,
      reason: "missing_account",
    });

    await expect(loadFormsAccess()).resolves.toEqual({ kind: "denied" });
    expect(authorizeCurrentSession).toHaveBeenCalledWith(client);
  });

  it("carries the trusted shift assignment into form availability", async () => {
    vi.mocked(createSupabaseServerClient).mockResolvedValue({} as never);
    vi.mocked(authorizeCurrentSession).mockResolvedValue({
      allowed: true,
      account: { role: "officer", shiftCode: "U" },
      sessionId: "fixture-session",
    } as never);

    await expect(loadFormsAccess()).resolves.toEqual({
      kind: "authorized",
      role: "officer",
      shiftCode: "U",
    });
  });

  it("carries the trusted administrator role into catalog availability", async () => {
    vi.mocked(createSupabaseServerClient).mockResolvedValue({} as never);
    vi.mocked(authorizeCurrentSession).mockResolvedValue({
      allowed: true,
      account: { role: "administrator", shiftCode: "F" },
      sessionId: "fixture-session",
    } as never);

    await expect(loadFormsAccess()).resolves.toEqual({
      kind: "authorized",
      role: "administrator",
      shiftCode: "F",
    });
  });

  it("shows officers physical guidance without an administrator action", async () => {
    vi.mocked(createSupabaseServerClient).mockResolvedValue({} as never);
    vi.mocked(authorizeCurrentSession).mockResolvedValue({
      allowed: true,
      account: { role: "officer", shiftCode: "A" },
      sessionId: "fixture-session",
    } as never);

    render(await FormsPage());

    expect(
      screen.getByRole("link", { name: /Open Count Sheet/ }),
    ).toHaveAttribute("href", "/count-sheet");
    expect(
      screen.queryByRole("link", { name: /Open Daily Paperwork/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText("Administrator only", { selector: "span" }),
    ).toBeVisible();
    expect(
      screen.getByRole("heading", { name: "Chain of Custody" }),
    ).toBeVisible();
    expect(screen.getByText("No digital substitute")).toBeVisible();
    expect(screen.queryByRole("link", { name: /Chain of Custody/ })).toBeNull();
  });

  it("gives administrators the protected Daily Paperwork entrance", async () => {
    vi.mocked(createSupabaseServerClient).mockResolvedValue({} as never);
    vi.mocked(authorizeCurrentSession).mockResolvedValue({
      allowed: true,
      account: { role: "administrator", shiftCode: "B" },
      sessionId: "fixture-session",
    } as never);

    render(await FormsPage());

    expect(
      screen.getByRole("link", { name: /Open Daily Paperwork/ }),
    ).toHaveAttribute("href", "/admin/paperwork/daily");
  });
});
