import type { DailyPaperworkSourceFile } from "./daily-paperwork-source-package";

const textEncoder = new TextEncoder();

function source(filename: string, body: unknown): DailyPaperworkSourceFile {
  return { filename, bytes: textEncoder.encode(JSON.stringify(body)) };
}

/** Fictional-only six-file package shared by unit tests. */
export function fictionalDailyPaperworkSourcePackage(): DailyPaperworkSourceFile[] {
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
