import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  summarizeDailyPaperworkSourcePackage,
  verifyDailyPaperworkSourcePackage,
  type DailyPaperworkSourceFile,
} from "./daily-paperwork-source-package";

const textEncoder = new TextEncoder();

function source(filename: string, body: unknown): DailyPaperworkSourceFile {
  return { filename, bytes: textEncoder.encode(JSON.stringify(body)) };
}

function fictionalPackage(): DailyPaperworkSourceFile[] {
  const common = { schema_version: 1, print_orientation: "landscape" };
  return [
    source("assignment_roster.json", {
      kind: "assignment_roster",
      title: "Fictional Assignment Roster",
      ...common,
      definition: {
        facility_label: "Fictional Training Facility",
        zones: [
          {
            code: "zone_one",
            label: "Fictional Zone",
            area: "Fictional Area",
            supervisor_label: "Fictional Supervisor",
            posts: [
              { code: "post_one", label: "Fictional Post", priority: "P1" },
            ],
          },
        ],
        assignment_states: ["unassigned", "assigned", "no_officer_available"],
        assignment_columns: ["Initial", "Rotation"],
        operational_fields: ["Fictional note"],
        security_equipment: ["Fictional equipment"],
        sign_off_fields: ["Fictional approval"],
        priority_one_warning: "Fictional priority warning.",
        notes: ["Fictional note"],
        distribution: ["Fictional recipient"],
      },
    }),
    source("uniform_inspection.json", {
      kind: "uniform_inspection",
      title: "Fictional Uniform Inspection",
      ...common,
      definition: {
        facility_label: "Fictional Training Facility",
        header_fields: ["Date"],
        columns: ["shirt"],
        column_labels: ["Shirt"],
        values: ["S", "N/I", "U", "NONE"],
        value_labels: {
          S: "Satisfactory",
          "N/I": "Needs improvement",
          U: "Unsatisfactory",
          NONE: "Not used",
        },
        comment_required_for: ["U"],
        sign_off_fields: ["Fictional reviewer"],
        footer_fields: ["Fictional distribution"],
      },
    }),
    source("metal_detector_test.json", {
      kind: "metal_detector_test",
      title: "Fictional Detector Test",
      ...common,
      definition: {
        header_fields: ["Date"],
        detectors: ["Training detector"],
        positions: ["Fictional test position"],
        values: ["P", "F"],
        value_labels: { P: "Pass", F: "Fail" },
        runtime_detector_fields: { location: "", equipment_identifier: "" },
        failure_requires_corrective_action: true,
        sign_off_fields: ["Fictional tester"],
        footer_fields: ["Fictional distribution"],
      },
    }),
    source("perimeter_check.json", {
      kind: "perimeter_check",
      title: "Fictional Perimeter Check",
      schema_version: 1,
      print_orientation: "portrait",
      definition: {
        values: ["S", "U"],
        value_labels: { S: "Satisfactory", U: "Unsatisfactory" },
        groups: [
          {
            code: "training_group",
            label: "Fictional Group",
            items: [{ code: "training_item", label: "Fictional Item" }],
          },
        ],
        sign_off_fields: ["Fictional inspector"],
      },
    }),
    source("random_search_log.json", {
      kind: "random_search_log",
      title: "Fictional Search Log",
      ...common,
      definition: {
        sections: ["Fictional Section"],
        blocks_per_section: 1,
        fields: ["staff_id"],
        field_labels: ["Fictional staff member"],
      },
    }),
    source("detector_sign_out.json", {
      kind: "detector_sign_out",
      title: "Fictional Detector Sign-Out",
      schema_version: 1,
      print_orientation: "portrait",
      definition: {
        units: ["Training unit"],
        fields: ["staff_id"],
        field_labels: ["Fictional staff member"],
      },
    }),
  ];
}

describe("Daily Paperwork private source package", () => {
  it("accepts all six strict fictional definitions and emits value-free evidence", () => {
    const verified = verifyDailyPaperworkSourcePackage(fictionalPackage());
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
      verifyDailyPaperworkSourcePackage(fictionalPackage().slice(1)),
    ).toThrow("All six Daily Paperwork source files are required.");
  });

  it("rejects a source whose filename and declared kind do not match", () => {
    const files = fictionalPackage();
    files[0] = { ...files[0], filename: "wrong_name.json" };
    expect(() => verifyDailyPaperworkSourcePackage(files)).toThrow(
      "Daily Paperwork source filename does not match its kind.",
    );
  });

  it("rejects populated equipment identifiers and markup-bearing labels", () => {
    const populated = fictionalPackage();
    const detector = JSON.parse(new TextDecoder().decode(populated[2].bytes));
    detector.definition.runtime_detector_fields.equipment_identifier = "REAL-1";
    populated[2] = source("metal_detector_test.json", detector);
    expect(() => verifyDailyPaperworkSourcePackage(populated)).toThrow();

    const markedUp = fictionalPackage();
    const roster = JSON.parse(new TextDecoder().decode(markedUp[0].bytes));
    roster.title = "<script>bad</script>";
    markedUp[0] = source("assignment_roster.json", roster);
    expect(() => verifyDailyPaperworkSourcePackage(markedUp)).toThrow();

    const identityBearing = fictionalPackage();
    const searchLog = JSON.parse(
      new TextDecoder().decode(identityBearing[4].bytes),
    );
    searchLog.title = "person@example.invalid";
    identityBearing[4] = source("random_search_log.json", searchLog);
    expect(() => verifyDailyPaperworkSourcePackage(identityBearing)).toThrow();
  });
});
