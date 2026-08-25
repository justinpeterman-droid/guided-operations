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
  it("calculates a fictional reconciliation locally without claiming a save", async () => {
    const user = userEvent.setup();
    render(<CountSheetPreview structure={structure} />);

    await user.type(screen.getByLabelText("Dining, unit 1"), "2");
    await user.type(screen.getByLabelText("In housing, unit 1"), "8");
    await user.type(screen.getByLabelText("Operational total, on site"), "10");

    expect(
      screen.getByText("Reconciled — review before any future save."),
    ).toBeVisible();
    expect(screen.getByText("Not saved")).toBeVisible();
  });

  it("keeps an unresolved difference visible instead of changing input values", async () => {
    const user = userEvent.setup();
    render(<CountSheetPreview structure={structure} />);

    await user.type(screen.getByLabelText("In housing, unit 1"), "8");
    await user.type(screen.getByLabelText("Operational total, on site"), "5");

    expect(
      screen.getByText(
        "Open difference — review the values; do not balance by guessing.",
      ),
    ).toBeVisible();
    expect(screen.getByLabelText("In housing, unit 1")).toHaveValue("8");
    expect(screen.getByLabelText("Operational total, on site")).toHaveValue(
      "5",
    );
  });
});
