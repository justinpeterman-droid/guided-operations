import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import {
  CountSheetComparison,
  countSheetDifferences,
} from "./count-sheet-comparison";
import { createBlankCountPayload } from "./calculations";
import { APPROVED_COUNT_SHEET_STRUCTURE } from "./approved-structure";
afterEach(cleanup);
it("shows only changed fields, keeps blank distinct from zero, and preserves both versions", () => {
  const current = createBlankCountPayload(APPROVED_COUNT_SHEET_STRUCTURE);
  const reviewed = structuredClone(current);
  reviewed.in_housing["9"] = 0;
  reviewed.cells["Chow Hall"]["1"] = 2;
  reviewed.count_started = "08:00";
  const original = JSON.stringify({ current, reviewed });
  render(
    <CountSheetComparison
      current={current}
      reviewed={reviewed}
      currentRevision={2}
      reviewedRevision={1}
    />,
  );
  const row = screen
    .getByRole("rowheader", { name: "In housing, 9" })
    .closest("tr")!;
  expect(within(row).getByText("Blank")).toBeVisible();
  expect(within(row).getByText("0")).toBeVisible();
  expect(
    screen.getByRole("columnheader", { name: "Current r2" }),
  ).toBeVisible();
  expect(
    screen.getByRole("columnheader", { name: "Reviewing r1" }),
  ).toBeVisible();
  expect(screen.getByText(/3 changed fields/)).toBeVisible();
  expect(screen.queryByRole("rowheader", { name: "In housing, 8" })).toBeNull();
  expect(JSON.stringify({ current, reviewed })).toBe(original);
});
it("reports identical versions without manufacturing changes", () => {
  const payload = createBlankCountPayload(APPROVED_COUNT_SHEET_STRUCTURE);
  expect(countSheetDifferences(payload, structuredClone(payload))).toEqual([]);
  render(
    <CountSheetComparison
      current={payload}
      reviewed={payload}
      currentRevision={2}
      reviewedRevision={1}
    />,
  );
  expect(screen.getByText(/No count or time differences/)).toBeVisible();
  expect(screen.queryByRole("table")).toBeNull();
});
