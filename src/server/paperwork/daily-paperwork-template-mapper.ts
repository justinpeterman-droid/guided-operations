import "server-only";

import {
  parseDailyPaperworkFormSchema,
  type DailyPaperworkField,
  type DailyPaperworkFormSchema,
} from "@/features/daily-paperwork/form-schema";

import type { VerifiedDailyPaperworkSource } from "./daily-paperwork-source-package";

export const DAILY_PAPERWORK_MAPPING_VERSION =
  "daily-paperwork-source-to-form-v1" as const;

export type MappedDailyPaperworkTemplate = Readonly<{
  kind: VerifiedDailyPaperworkSource["kind"];
  title: string;
  printOrientation: "portrait" | "landscape";
  mappingVersion: typeof DAILY_PAPERWORK_MAPPING_VERSION;
  structure: Readonly<Record<string, unknown>>;
  fieldSchema: DailyPaperworkFormSchema;
}>;

/**
 * Converts one validated private source definition into the generic protected
 * renderer contract. The mapping version is approval-bound by the package
 * manifest; changing this function requires a new mapping version.
 */
export function mapDailyPaperworkTemplate(
  verified: VerifiedDailyPaperworkSource,
): MappedDailyPaperworkTemplate {
  const source = verified.source;
  const fieldSchema = parseDailyPaperworkFormSchema(
    source.kind === "assignment_roster"
      ? mapAssignmentRoster(source.definition)
      : source.kind === "uniform_inspection"
        ? mapUniformInspection(source.definition)
        : source.kind === "metal_detector_test"
          ? mapMetalDetector(source.definition)
          : source.kind === "perimeter_check"
            ? mapPerimeterCheck(source.definition)
            : source.kind === "random_search_log"
              ? mapRandomSearch(source.definition)
              : mapDetectorSignOut(source.definition),
  );

  return {
    kind: source.kind,
    title: source.title,
    printOrientation: source.print_orientation,
    mappingVersion: DAILY_PAPERWORK_MAPPING_VERSION,
    structure: {
      schema_version: 1,
      mapping_version: DAILY_PAPERWORK_MAPPING_VERSION,
      source_kind: source.kind,
      source_definition: source.definition,
    },
    fieldSchema,
  };
}

function mapAssignmentRoster(
  definition: Extract<
    VerifiedDailyPaperworkSource["source"],
    { kind: "assignment_roster" }
  >["definition"],
) {
  const posts = definition.zones.flatMap((zone) =>
    zone.posts.map((post) => `${zone.label} · ${post.label}`),
  );
  if (posts.length > 500)
    throw new Error("The assignment roster has too many posts to map safely.");

  return {
    schema_version: 1,
    fields: [
      ...textFields("operational", definition.operational_fields),
      ...textFields("equipment", definition.security_equipment),
      ...textFields("sign_off", definition.sign_off_fields),
    ],
    tables: [
      {
        key: "assignments",
        label: "Assignments",
        help_text: definition.priority_one_warning,
        min_rows: 0,
        max_rows: posts.length,
        columns: [
          selectField("post", "Post", posts),
          selectField(
            "assignment_state",
            "Assignment state",
            definition.assignment_states,
          ),
          ...definition.assignment_columns.map((label, index) =>
            textField(`assignment_${index + 1}`, label, 160),
          ),
        ],
      },
    ],
  };
}

function mapUniformInspection(
  definition: Extract<
    VerifiedDailyPaperworkSource["source"],
    { kind: "uniform_inspection" }
  >["definition"],
) {
  const options = definition.values.map(
    (value) => definition.value_labels[value],
  );
  return {
    schema_version: 1,
    fields: [
      ...textFields("header", definition.header_fields),
      ...textFields("sign_off", definition.sign_off_fields),
      ...textFields("footer", definition.footer_fields),
    ],
    tables: [
      {
        key: "inspections",
        label: "Uniform inspections",
        help_text: "Choose the reviewed result for each inspected item.",
        min_rows: 0,
        max_rows: 500,
        columns: [
          textField("staff_reference", "Staff member", 160),
          ...definition.columns.map((key, index) =>
            selectField(key, definition.column_labels[index], options),
          ),
          textField("comments", "Comments", 1000),
        ],
      },
    ],
  };
}

function mapMetalDetector(
  definition: Extract<
    VerifiedDailyPaperworkSource["source"],
    { kind: "metal_detector_test" }
  >["definition"],
) {
  return {
    schema_version: 1,
    fields: [
      ...textFields("header", definition.header_fields),
      textField("detector_location", "Detector location", 160),
      textField("equipment_identifier", "Equipment identifier", 160),
      ...textFields("sign_off", definition.sign_off_fields),
      ...textFields("footer", definition.footer_fields),
    ],
    tables: [
      {
        key: "detector_tests",
        label: "Detector tests",
        min_rows: 0,
        max_rows: 500,
        columns: [
          selectField("detector", "Detector", definition.detectors),
          selectField("position", "Test position", definition.positions),
          selectField(
            "result",
            "Result",
            definition.values.map((value) => definition.value_labels[value]),
          ),
          textField("corrective_action", "Corrective action", 1000),
        ],
      },
    ],
  };
}

function mapPerimeterCheck(
  definition: Extract<
    VerifiedDailyPaperworkSource["source"],
    { kind: "perimeter_check" }
  >["definition"],
) {
  const items = definition.groups.flatMap((group) =>
    group.items.map((item) => `${group.label} · ${item.label}`),
  );
  if (items.length > 500)
    throw new Error(
      "The perimeter checklist has too many items to map safely.",
    );
  return {
    schema_version: 1,
    fields: textFields("sign_off", definition.sign_off_fields),
    tables: [
      {
        key: "perimeter_checks",
        label: "Perimeter checks",
        min_rows: 0,
        max_rows: items.length,
        columns: [
          selectField("item", "Check item", items),
          selectField(
            "result",
            "Result",
            definition.values.map((value) => definition.value_labels[value]),
          ),
          textField("comments", "Comments", 1000),
        ],
      },
    ],
  };
}

function mapRandomSearch(
  definition: Extract<
    VerifiedDailyPaperworkSource["source"],
    { kind: "random_search_log" }
  >["definition"],
) {
  return {
    schema_version: 1,
    fields: [],
    tables: definition.sections.map((section, sectionIndex) => ({
      key: `section_${sectionIndex + 1}`,
      label: section,
      min_rows: 0,
      max_rows: definition.blocks_per_section,
      columns: definition.fields.map((key, fieldIndex) =>
        textField(key, definition.field_labels[fieldIndex], 500),
      ),
    })),
  };
}

function mapDetectorSignOut(
  definition: Extract<
    VerifiedDailyPaperworkSource["source"],
    { kind: "detector_sign_out" }
  >["definition"],
) {
  return {
    schema_version: 1,
    fields: [],
    tables: [
      {
        key: "sign_outs",
        label: "Detector sign-out",
        min_rows: 0,
        max_rows: 500,
        columns: [
          selectField("unit", "Unit", definition.units),
          ...definition.fields.map((key, fieldIndex) =>
            textField(key, definition.field_labels[fieldIndex], 500),
          ),
        ],
      },
    ],
  };
}

function textFields(
  prefix: string,
  labels: readonly string[],
): DailyPaperworkField[] {
  return labels.map((label, index) =>
    textField(`${prefix}_${index + 1}`, label, 500),
  );
}

function textField(
  key: string,
  label: string,
  maxLength: number,
): DailyPaperworkField {
  return { key, label, required: false, type: "text", max_length: maxLength };
}

function selectField(
  key: string,
  label: string,
  options: readonly string[],
): DailyPaperworkField {
  return { key, label, required: false, type: "select", options: [...options] };
}
