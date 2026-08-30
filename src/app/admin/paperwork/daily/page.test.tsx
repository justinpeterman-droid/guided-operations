import { describe, expect, it } from "vitest";

import { resolveDailyPaperworkSelection } from "@/features/daily-paperwork/selection";

describe("Daily Paperwork selection", () => {
  it("accepts each owner-approved shift meaning", () => {
    for (const shiftCode of ["A", "B", "C", "D", "U", "F"]) {
      expect(
        resolveDailyPaperworkSelection(
          { workDate: "2026-08-27", shiftCode },
          "2026-08-28",
        ),
      ).toEqual({ workDate: "2026-08-27", shiftCode });
    }
  });

  it("rejects malformed dates, shifts, and duplicate parameter values", () => {
    expect(
      resolveDailyPaperworkSelection(
        { workDate: "not-a-date", shiftCode: "A" },
        "2026-08-28",
      ),
    ).toBeNull();
    expect(
      resolveDailyPaperworkSelection(
        { workDate: "2026-08-27", shiftCode: "Z" },
        "2026-08-28",
      ),
    ).toBeNull();
    expect(
      resolveDailyPaperworkSelection(
        { workDate: ["2026-08-27", "2026-08-28"], shiftCode: "A" },
        "2026-08-28",
      ),
    ).toBeNull();
  });
});
