import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { parseDailyPaperworkFormSchema } from "@/features/daily-paperwork/form-schema";

import { fictionalDailyPaperworkSourcePackage } from "./daily-paperwork-source-package.test-fixture";
import { verifyDailyPaperworkSourcePackage } from "./daily-paperwork-source-package";
import {
  DAILY_PAPERWORK_MAPPING_VERSION,
  mapDailyPaperworkTemplate,
} from "./daily-paperwork-template-mapper";

describe("Daily Paperwork private template mapper", () => {
  it("maps all six fictional sources into the separate renderer contract", () => {
    const mapped = verifyDailyPaperworkSourcePackage(
      fictionalDailyPaperworkSourcePackage(),
    ).map(mapDailyPaperworkTemplate);

    expect(mapped).toHaveLength(6);
    expect(mapped.map(({ kind }) => kind)).toEqual([
      "assignment_roster",
      "uniform_inspection",
      "metal_detector_test",
      "perimeter_check",
      "random_search_log",
      "detector_sign_out",
    ]);
    expect(
      mapped.every(
        (template) =>
          template.mappingVersion === DAILY_PAPERWORK_MAPPING_VERSION,
      ),
    ).toBe(true);
    for (const template of mapped)
      expect(() =>
        parseDailyPaperworkFormSchema(template.fieldSchema),
      ).not.toThrow();
  });

  it("preserves source order and controlled values without runtime entries", () => {
    const verified = verifyDailyPaperworkSourcePackage(
      fictionalDailyPaperworkSourcePackage(),
    );
    const roster = mapDailyPaperworkTemplate(verified[0]);
    const detector = mapDailyPaperworkTemplate(verified[2]);

    expect(roster.fieldSchema.tables[0].columns[0]).toMatchObject({
      key: "post",
      options: ["Fictional Zone · Fictional Post"],
    });
    expect(detector.fieldSchema.fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "equipment_identifier",
          required: false,
        }),
      ]),
    );
    expect(JSON.stringify(detector.fieldSchema)).not.toContain("REAL-1");
  });
});
