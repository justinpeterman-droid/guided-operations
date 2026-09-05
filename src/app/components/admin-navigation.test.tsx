import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AdminNavigation } from "./admin-navigation";
const route = vi.hoisted(() => ({ pathname: "/admin" }));
vi.mock("next/navigation", () => ({ usePathname: () => route.pathname }));
afterEach(cleanup);
describe("AdminNavigation", () => {
  it.each([
    ["/admin", "Overview"],
    ["/admin/accounts", "Accounts"],
    ["/admin/paperwork/daily/packages", "Daily paperwork"],
  ])("marks only the destination for %s", (pathname, label) => {
    route.pathname = pathname;
    render(<AdminNavigation />);
    const nav = within(
      screen.getByRole("navigation", { name: "Administration" }),
    );
    expect(nav.getAllByRole("link", { current: "page" })).toHaveLength(1);
    expect(nav.getByRole("link", { name: label })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(nav.getByRole("link", { name: "Records controls" })).toHaveAttribute(
      "href",
      "/admin/retention",
    );
  });
});
