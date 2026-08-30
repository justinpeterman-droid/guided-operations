import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  summarizeDailyPaperworkSourcePackage,
  verifyDailyPaperworkSourcePackage,
} from "./daily-paperwork-source-package";
import { fictionalDailyPaperworkSourcePackage } from "./daily-paperwork-source-package.test-fixture";

const textEncoder = new TextEncoder();

function source(filename: string, body: unknown) {
  return { filename, bytes: textEncoder.encode(JSON.stringify(body)) };
}

describe("Daily Paperwork private source package", () => {
  it("accepts all six strict fictional definitions and emits value-free evidence", () => {
    const verified = verifyDailyPaperworkSourcePackage(
      fictionalDailyPaperworkSourcePackage(),
    );
    const summary = summarizeDailyPaperworkSourcePackage(verified);

    expect(verified.map(({ kind }) => kind)).toEqual([
      "assignment_roster",
      "uniform_inspection",
      "metal_detector_test",
      "perimeter_check",
      "random_search_log",
      "detector_sign_out",
    ]);
    expect(summary.sourceCount).toBe(6);
    expect(summary.totalBytes).toBeGreaterThan(0);
    expect(
      summary.sources.every(({ sha256 }) => /^[a-f0-9]{64}$/.test(sha256)),
    ).toBe(true);
    expect(JSON.stringify(summary)).not.toContain("Fictional");
  });

  it("rejects a partial package before any definition can be registered", () => {
    expect(() =>
      verifyDailyPaperworkSourcePackage(
        fictionalDailyPaperworkSourcePackage().slice(1),
      ),
    ).toThrow("All six Daily Paperwork source files are required.");
  });

  it("rejects a source whose filename and declared kind do not match", () => {
    const files = fictionalDailyPaperworkSourcePackage();
    files[0] = { ...files[0], filename: "wrong_name.json" };
    expect(() => verifyDailyPaperworkSourcePackage(files)).toThrow(
      "Daily Paperwork source filename does not match its kind.",
    );
  });

  it("rejects populated equipment identifiers and markup-bearing labels", () => {
    const populated = fictionalDailyPaperworkSourcePackage();
    const detector = JSON.parse(new TextDecoder().decode(populated[2].bytes));
    detector.definition.runtime_detector_fields.equipment_identifier = "REAL-1";
    populated[2] = source("metal_detector_test.json", detector);
    expect(() => verifyDailyPaperworkSourcePackage(populated)).toThrow();

    const markedUp = fictionalDailyPaperworkSourcePackage();
    const roster = JSON.parse(new TextDecoder().decode(markedUp[0].bytes));
    roster.title = "<script>bad</script>";
    markedUp[0] = source("assignment_roster.json", roster);
    expect(() => verifyDailyPaperworkSourcePackage(markedUp)).toThrow();

    const identityBearing = fictionalDailyPaperworkSourcePackage();
    const searchLog = JSON.parse(
      new TextDecoder().decode(identityBearing[4].bytes),
    );
    searchLog.title = "person@example.invalid";
    identityBearing[4] = source("random_search_log.json", searchLog);
    expect(() => verifyDailyPaperworkSourcePackage(identityBearing)).toThrow();
  });
});
