import { describe, expect, it } from "vitest";

import {
  REPORT_TYPES,
  getReportTypeDefinition,
  reportTypeSchema,
} from "./report-types";

describe("controlled report package", () => {
  it("contains only the four recovered report types", () => {
    expect(REPORT_TYPES).toEqual([
      "first_person",
      "supervisor_summary",
      "cover_letter",
      "disciplinary",
    ]);
  });

  it("binds each type to an explicit narrative perspective", () => {
    expect(getReportTypeDefinition("first_person").perspective).toBe(
      "first_person",
    );
    expect(getReportTypeDefinition("supervisor_summary").perspective).toBe(
      "third_person",
    );
    expect(getReportTypeDefinition("cover_letter").perspective).toBe(
      "third_person",
    );
    expect(getReportTypeDefinition("disciplinary").perspective).toBe(
      "third_person",
    );
  });

  it("rejects an invented report type", () => {
    expect(reportTypeSchema.safeParse("invented_report").success).toBe(false);
  });
});
