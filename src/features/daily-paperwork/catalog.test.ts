import { describe, expect, it } from "vitest";

import {
  dailyPaperworkCatalog,
  dailyPaperworkKindSchema,
  shiftCodeSchema,
  shiftLabel,
} from "./catalog";

describe("Daily Paperwork catalog", () => {
  it("keeps the six approved source workflow names in stable order", () => {
    expect(dailyPaperworkCatalog.map((item) => item.kind)).toEqual([
      "assignment_roster",
      "uniform_inspection",
      "metal_detector_test",
      "perimeter_check",
      "random_search_log",
      "detector_sign_out",
    ]);
    expect(
      dailyPaperworkCatalog.every(
        (item) => dailyPaperworkKindSchema.safeParse(item.kind).success,
      ),
    ).toBe(true);
  });

  it("preserves the owner-approved shift meanings", () => {
    expect(shiftLabel(shiftCodeSchema.parse("A"))).toBe("A · Day shift");
    expect(shiftLabel(shiftCodeSchema.parse("B"))).toBe("B · Day shift");
    expect(shiftLabel(shiftCodeSchema.parse("C"))).toBe("C · Night shift");
    expect(shiftLabel(shiftCodeSchema.parse("D"))).toBe("D · Night shift");
    expect(shiftLabel(shiftCodeSchema.parse("U"))).toBe("U · Five-day week");
    expect(shiftLabel(shiftCodeSchema.parse("F"))).toBe(
      "F · Five-day week field",
    );
    expect(shiftCodeSchema.safeParse("Z").success).toBe(false);
  });
});
