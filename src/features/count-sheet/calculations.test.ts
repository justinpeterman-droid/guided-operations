import { describe, expect, it } from "vitest";

import {
  calculateCountTotals,
  createBlankCountPayload,
  parseCountValue,
} from "./calculations";
import type { CountSheetStructure } from "./types";

const STRUCTURE: CountSheetStructure = {
  schema_version: 1,
  title: "Fictional Training Facility Count Sheet",
  columns: ["1", "2", "Iso", "Inf"],
  areas: ["Administration", "Dining"],
  operational_fields: [
    "on_site",
    "gate_pass",
    "transfers",
    "court",
    "hospital",
    "furlough",
    "other",
  ],
  attachment_reminders: ["court", "hospital", "furlough"],
};

describe("Count Sheet calculations", () => {
  it("matches the reconciliation calculation and preserves blanks", () => {
    const payload = createBlankCountPayload(STRUCTURE);
    payload.cells.Administration["1"] = 2;
    payload.cells.Dining["1"] = 3;
    payload.in_housing["1"] = 10;
    payload.in_housing["2"] = 5;
    payload.operational.on_site = 17;
    payload.operational.court = 3;

    const totals = calculateCountTotals(STRUCTURE, payload);

    expect(totals.row_totals).toEqual({ Administration: 2, Dining: 3 });
    expect(totals.out_of_housing).toEqual({
      "1": 5,
      "2": 0,
      Iso: 0,
      Inf: 0,
    });
    expect(totals.unit_totals).toEqual({
      "1": 15,
      "2": 5,
      Iso: 0,
      Inf: 0,
    });
    expect(totals.housing_total).toBe(20);
    expect(totals.operational_total).toBe(20);
    expect(totals.difference).toBe(0);
    expect(totals.reconciled).toBe(true);
    expect(payload.cells.Administration["2"]).toBeNull();
  });

  it("returns the signed difference without balancing officer values", () => {
    const payload = createBlankCountPayload(STRUCTURE);
    payload.in_housing["1"] = 20;
    payload.operational.on_site = 18;
    expect(calculateCountTotals(STRUCTURE, payload).difference).toBe(2);

    payload.operational.on_site = 22;
    expect(calculateCountTotals(STRUCTURE, payload).difference).toBe(-2);
    expect(payload.in_housing["1"]).toBe(20);
    expect(payload.operational.on_site).toBe(22);
  });

  it("accepts blank or whole-number text and rejects non-digits", () => {
    expect(parseCountValue("")).toBeNull();
    expect(parseCountValue("0")).toBe(0);
    expect(parseCountValue("27")).toBe(27);
    expect(() => parseCountValue("-1")).toThrow(/whole number/i);
    expect(() => parseCountValue("1.5")).toThrow(/whole number/i);
    expect(() => parseCountValue("2 people")).toThrow(/whole number/i);
  });

  it("rejects unknown or missing source rows before calculation", () => {
    const payload = createBlankCountPayload(STRUCTURE);
    delete payload.cells.Administration;
    expect(() => calculateCountTotals(STRUCTURE, payload)).toThrow(
      /approved structure/i,
    );

    const unknown = createBlankCountPayload(STRUCTURE);
    unknown.cells["Unknown Area"] = {
      "1": null,
      "2": null,
      Iso: null,
      Inf: null,
    };
    expect(() => calculateCountTotals(STRUCTURE, unknown)).toThrow(
      /approved structure/i,
    );
  });
});
