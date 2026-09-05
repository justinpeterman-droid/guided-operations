import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { CountSheetPreview } from "./count-sheet-preview";
import type { CountSheetStructure } from "./types";

const structure: CountSheetStructure = {
  schema_version: 1,
  title: "Fictional training count sheet",
  columns: ["1"],
  areas: ["Dining"],
  operational_fields: ["on_site"],
  attachment_reminders: ["on_site"],
};

afterEach(cleanup);

describe("CountSheetPreview", () => {
  it("toggles whole columns independently without changing entered counts", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <CountSheetPreview structure={{ ...structure, columns: ["1", "2"] }} />,
    );
    await user.type(screen.getByLabelText("In housing, 1"), "8");
    const first = screen.getByRole("button", {
      name: "Column 1 total 8. Highlight red",
    });
    const second = screen.getByRole("button", {
      name: "Column 2 total 0. Highlight red",
    });
    expect(first.closest("tr")).toHaveClass("count-sheet-total-row");
    expect(first).toHaveTextContent("8");
    expect(container.querySelectorAll("thead button")).toHaveLength(0);
    await user.click(first);
    expect(first).toHaveAttribute("aria-pressed", "true");
    expect(first).toHaveAccessibleName("Column 1 total 8. Clear red highlight");
    expect(second).toHaveAttribute("aria-pressed", "false");
    expect(
      container.querySelectorAll(".count-sheet-column-flagged"),
    ).toHaveLength(5);
    await user.click(second);
    await user.click(first);
    expect(first).toHaveAttribute("aria-pressed", "false");
    expect(second).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByLabelText("In housing, 1")).toHaveValue("8");
    expect(
      screen.getByLabelText("In housing, 1").closest("td"),
    ).not.toHaveClass("count-sheet-column-flagged");
    expect(screen.getByLabelText("In housing, 2").closest("td")).toHaveClass(
      "count-sheet-column-flagged",
    );
  });
  it("does not call a blank training sheet reconciled", () => {
    render(<CountSheetPreview structure={structure} />);

    expect(
      screen.getByText("Incomplete — enter known values to reconcile."),
    ).toBeVisible();
    expect(
      screen.queryByText("Reconciled — review before any future save."),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("region", {
        name: "Count entries by fictional area and unit",
      }),
    ).toHaveTextContent("Swipe to view all units");
  });

  it("calculates a fictional reconciliation locally without claiming a save", async () => {
    const user = userEvent.setup();
    render(<CountSheetPreview structure={structure} />);

    await user.type(screen.getByLabelText("Dining, 1"), "2");
    await user.type(screen.getByLabelText("In housing, 1"), "8");
    await user.type(screen.getByLabelText("Operational total, on site"), "10");

    expect(
      screen.getByText("Reconciled — review before any future save."),
    ).toBeVisible();
    expect(screen.getByText("Not saved")).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Print training preview" }),
    ).toBeVisible();
  });

  it("keeps an unresolved difference visible instead of changing input values", async () => {
    const user = userEvent.setup();
    render(<CountSheetPreview structure={structure} />);

    await user.type(screen.getByLabelText("Dining, 1"), "0");
    await user.type(screen.getByLabelText("In housing, 1"), "8");
    await user.type(screen.getByLabelText("Operational total, on site"), "5");

    expect(screen.getByText("+3")).toBeVisible();
    expect(screen.getByText("Difference")).toBeVisible();

    expect(
      screen.getByText(
        "Open difference — review the values; do not balance by guessing.",
      ),
    ).toBeVisible();
    expect(screen.getByLabelText("In housing, 1")).toHaveValue("8");
    expect(screen.getByLabelText("Operational total, on site")).toHaveValue(
      "5",
    );
  });
});
