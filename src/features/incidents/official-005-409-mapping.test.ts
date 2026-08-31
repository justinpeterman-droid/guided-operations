import { describe, expect, it } from "vitest";

import { buildOfficial005409Mapping } from "./official-005-409-mapping";

describe("buildOfficial005409Mapping", () => {
  it("marks both 005 and 409 for use-of-force incidents", () => {
    const result = buildOfficial005409Mapping({
      category: "use_of_force",
      occurredAt: "2026-08-30T21:50:00-05:00",
      location: "NCU Barracks 1",
    });

    expect(result.designations).toEqual({ form005: "X", form409: "X" });
  });

  it("marks 005 only for ordinary incident categories", () => {
    const result = buildOfficial005409Mapping({
      category: "contraband",
      occurredAt: "2026-08-30T21:50:00-05:00",
      location: "NCU Barracks 1",
    });

    expect(result.designations).toEqual({ form005: "X", form409: "" });
  });

  it("formats the dedicated 005 time field as APX. h:mm AM/PM", () => {
    const result = buildOfficial005409Mapping({
      category: "incident_no_disciplinary",
      occurredAt: "2026-08-30T21:50:00-05:00",
      location: "NCU Barracks 1",
    });

    expect(result.approximateTime).toBe("APX. 9:50 PM");
  });

  it("uses the approved presence value without inventing additional facts", () => {
    const result = buildOfficial005409Mapping({
      category: "medical_emergency",
      occurredAt: "2026-08-30T09:05:00-05:00",
      location: "NCU Barracks 1",
    });

    expect(result.presence).toBe("Same as above");
    expect(result.location).toBe("NCU Barracks 1");
  });

  it("rejects timestamps without an explicit timezone offset", () => {
    expect(() =>
      buildOfficial005409Mapping({
        category: "contraband",
        occurredAt: "2026-08-30T21:50:00",
        location: "NCU Barracks 1",
      }),
    ).toThrow("occurredAt must include an explicit timezone offset");
  });

  it.each(["+24:00", "+05:60"])(
    "rejects an invalid timezone offset %s",
    (offset) => {
      expect(() =>
        buildOfficial005409Mapping({
          category: "contraband",
          occurredAt: `2026-08-30T21:50:00${offset}`,
          location: "NCU Barracks 1",
        }),
      ).toThrow("occurredAt must include an explicit timezone offset");
    },
  );
});
